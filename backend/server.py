from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Header, Form, Query, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from starlette.middleware.cors import CORSMiddleware
from io import BytesIO
import base64
import json
import os
import logging
import httpx
import hmac
import hashlib
import html
import re
from urllib.parse import quote, unquote
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

# Shopify config
SHOPIFY_STORE = os.environ.get('SHOPIFY_STORE_DOMAIN')
SHOPIFY_TOKEN = os.environ.get('SHOPIFY_STOREFRONT_TOKEN')
SHOPIFY_ADMIN_TOKEN = os.environ.get('SHOPIFY_ADMIN_ACCESS_TOKEN')
SHOPIFY_WEBHOOK_SECRET = os.environ.get('SHOPIFY_WEBHOOK_SECRET', '')
SHOPIFY_API_VERSION = "2024-10"
SHOPIFY_GRAPHQL_URL = f"https://{SHOPIFY_STORE}/api/{SHOPIFY_API_VERSION}/graphql.json"
SHOPIFY_ADMIN_API_VERSION = "2026-07"
SHOPIFY_ADMIN_GRAPHQL_URL = f"https://{SHOPIFY_STORE}/admin/api/{SHOPIFY_ADMIN_API_VERSION}/graphql.json"

# Supabase config
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

# Disable API documentation in production to avoid schema exposure
_ENV = os.environ.get('ENV', 'development').lower()
_IS_PRODUCTION = _ENV == 'production' or os.environ.get('PRODUCTION', 'false').lower() == 'true'

app = FastAPI(
    title="Floarea API",
    docs_url=None if _IS_PRODUCTION else "/docs",
    redoc_url=None if _IS_PRODUCTION else "/redoc",
    openapi_url=None if _IS_PRODUCTION else "/openapi.json",
)
api_router = APIRouter(prefix="/api")
templates = Jinja2Templates(directory=str(ROOT_DIR / "templates"))

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Hidden collections to exclude from display
HIDDEN_COLLECTIONS = {"frontpage", "box", "box-preserved-flower"}

# Featured collections for home page
FEATURED_COLLECTIONS = [
    "forever-special-occasion-roses", "fresh-special-occasion-flowers",
    "birthday-flowers", "luxurious", "special-occasions", "wedding-florist",
    "love-collection", "congratulations"
]


# ─── Shopify GraphQL Helper ───
async def shopify_graphql(query: str, variables: dict = None) -> dict:
    headers = {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": SHOPIFY_TOKEN,
    }
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    async with httpx.AsyncClient(timeout=15) as client_http:
        response = await client_http.post(SHOPIFY_GRAPHQL_URL, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        if "errors" in data:
            logger.error(f"Shopify GraphQL errors: {data['errors']}")
            raise HTTPException(status_code=502, detail="Shopify API error")
        return data.get("data", {})


# ─── Shopify Admin GraphQL Helper ───
async def shopify_admin_graphql(query: str, variables: dict = None) -> dict:
    if not SHOPIFY_STORE:
        logger.error("SHOPIFY_STORE_DOMAIN is not configured")
        raise HTTPException(status_code=500, detail="Shopify store domain missing")
    if not SHOPIFY_ADMIN_TOKEN:
        logger.error("SHOPIFY_ADMIN_ACCESS_TOKEN is not configured")
        raise HTTPException(status_code=500, detail="Shopify Admin API token missing")

    headers = {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
    }
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    try:
        async with httpx.AsyncClient(timeout=15) as client_http:
            response = await client_http.post(SHOPIFY_ADMIN_GRAPHQL_URL, json=payload, headers=headers)
    except httpx.RequestError as e:
        logger.error(f"Shopify Admin API network error: {e}")
        raise HTTPException(status_code=503, detail="Shopify Admin API unavailable")

    if response.status_code in (401, 403):
        logger.error(f"Shopify Admin API authentication failed: {response.status_code} - {response.text}")
        raise HTTPException(status_code=401, detail="Invalid Shopify Admin API token")
    if response.status_code >= 400:
        logger.error(f"Shopify Admin API HTTP error: {response.status_code} - {response.text}")
        raise HTTPException(status_code=502, detail="Shopify Admin API error")

    try:
        data = response.json()
    except ValueError:
        logger.error(f"Shopify Admin API returned non-JSON response: {response.text}")
        raise HTTPException(status_code=502, detail="Invalid Shopify Admin API response")

    if "errors" in data:
        logger.error(f"Shopify Admin GraphQL errors: {data['errors']}")
        raise HTTPException(status_code=502, detail="Shopify Admin GraphQL error")

    return data.get("data", {})


# Supabase Helper
async def _supabase_request(
    method: str,
    path: str,
    json_data: Optional[dict] = None,
    params: Optional[dict] = None,
    headers: Optional[dict] = None
) -> httpx.Response:
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("Supabase URL or Key not configured")
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    
    req_headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    if headers:
        req_headers.update(headers)
        
    url = f"{SUPABASE_URL.rstrip('/')}{path}"
    
    async with httpx.AsyncClient(timeout=10) as client_http:
        response = await client_http.request(
            method=method,
            url=url,
            json=json_data,
            params=params,
            headers=req_headers
        )
        if response.status_code >= 400:
            logger.error(f"Supabase request failed: {response.status_code} - {response.text}")
        return response


# ─── Shopify Data Transformers ───
def transform_product(node: dict) -> dict:
    images = [edge["node"]["url"] for edge in node.get("images", {}).get("edges", [])]
    variants = []
    for v_edge in node.get("variants", {}).get("edges", []):
        v = v_edge["node"]
        variants.append({
            "id": v["id"],
            "title": v.get("title", "Default"),
            "price": float(v.get("priceV2", v.get("price", {})).get("amount", 0)),
            "currency": v.get("priceV2", v.get("price", {})).get("currencyCode", "AED"),
            "available": v.get("availableForSale", False),
        })
    price_range = node.get("priceRange", {}).get("minVariantPrice", {})
    collections = [e["node"]["title"] for e in node.get("collections", {}).get("edges", [])]

    return {
        "id": node["id"],
        "handle": node["handle"],
        "title": node["title"],
        "description": node.get("description", ""),
        "price": float(price_range.get("amount", 0)),
        "currency": price_range.get("currencyCode", "AED"),
        "image": images[0] if images else "",
        "images": images,
        "variants": variants,
        "available": node.get("availableForSale", False),
        "tags": node.get("tags", []),
        "collections": collections,
        "variant_id": variants[0]["id"] if variants else "",
    }

def transform_collection(node: dict) -> dict:
    return {
        "id": node["id"],
        "handle": node["handle"],
        "title": node["title"],
        "description": node.get("description", ""),
        "image": node.get("image", {}).get("url", "") if node.get("image") else "",
    }


def transform_metaobject_fields(node: dict) -> dict:
    result = {
        "id": node.get("id"),
        "handle": node.get("handle")
    }
    for field in node.get("fields", []):
        key = field.get("key")
        if not key:
            continue
        ref = field.get("reference")
        if ref and isinstance(ref, dict):
            image = ref.get("image")
            if image and isinstance(image, dict):
                result[key] = image.get("url", "")
            else:
                result[key] = ""
        else:
            result[key] = field.get("value", "")
    return result


# ─── Homepage Layout Helpers ───
HOMEPAGE_TEMPLATE_FILE = "templates/index.json"
HOMEPAGE_SECTION_TYPES = {
    "slider": "hero",
    "collection-list": "occasions",
    "custom-content": "promoBanner",
    "blurred-section": "eventsBanner",
}


def _normalize_theme_section_type(section_type: str) -> str:
    normalized = (section_type or "").strip().lower()
    if "/" in normalized:
        normalized = normalized.rsplit("/", 1)[-1]
    if normalized.endswith(".liquid"):
        normalized = normalized[:-7]
    return normalized


def _is_theme_item_disabled(item: dict) -> bool:
    return bool((item or {}).get("disabled"))


def _ordered_theme_sections(template: dict) -> list:
    sections = template.get("sections") or {}
    order = template.get("order") or []
    ordered = []
    seen = set()

    for section_id in order:
        section = sections.get(section_id)
        if section:
            ordered.append((section_id, section))
            seen.add(section_id)

    for section_id, section in sections.items():
        if section_id not in seen:
            ordered.append((section_id, section))

    return ordered


def _clean_theme_blocks(section: dict) -> list:
    blocks = section.get("blocks") or {}
    block_order = section.get("block_order") or []
    ordered_blocks = []
    seen = set()

    for block_id in block_order:
        block = blocks.get(block_id)
        if block:
            ordered_blocks.append((block_id, block))
            seen.add(block_id)

    for block_id, block in blocks.items():
        if block_id not in seen:
            ordered_blocks.append((block_id, block))

    return [
        {
            "id": block_id,
            "type": block.get("type", ""),
            "settings": block.get("settings") or {},
        }
        for block_id, block in ordered_blocks
        if not _is_theme_item_disabled(block)
    ]


def _clean_theme_section(section_id: str, section: dict) -> dict:
    return {
        "id": section_id,
        "type": section.get("type", ""),
        "settings": section.get("settings") or {},
        "blocks": _clean_theme_blocks(section),
    }


def _parse_homepage_layout_template(template: dict) -> dict:
    layout = {
        "hero": {},
        "occasions": {},
        "promoBanner": {},
        "eventsBanner": {},
    }

    for section_id, section in _ordered_theme_sections(template):
        if _is_theme_item_disabled(section):
            continue

        layout_key = HOMEPAGE_SECTION_TYPES.get(_normalize_theme_section_type(section.get("type", "")))
        if not layout_key or layout[layout_key]:
            continue

        layout[layout_key] = _clean_theme_section(section_id, section)

    return layout


def _theme_setting(source: dict, *keys: str) -> str:
    settings = (source or {}).get("settings") or source or {}
    for key in keys:
        value = settings.get(key)
        if value is not None:
            return value
    return ""


def _theme_blocks(section: dict) -> list:
    return (section or {}).get("blocks") or []


def _theme_blocks_by_type(section: dict, block_type: str) -> list:
    return [block for block in _theme_blocks(section) if block.get("type") == block_type]


def _merged_theme_source(section: dict) -> dict:
    settings = dict((section or {}).get("settings") or {})
    for block in _theme_blocks(section):
        settings.update(block.get("settings") or {})
    return {"settings": settings}


def _strip_theme_html(value: str) -> str:
    if not isinstance(value, str) or "<" not in value or ">" not in value:
        return value or ""

    normalized = re.sub(r"<\s*br\s*/?\s*>", "\n", value, flags=re.IGNORECASE)
    normalized = re.sub(r"</\s*p\s*>", "\n", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"<[^>]+>", "", normalized)
    normalized = html.unescape(normalized)
    lines = [line.strip() for line in normalized.splitlines()]
    return "\n".join(line for line in lines if line).strip()


def _theme_text(source: dict, *keys: str) -> str:
    return _strip_theme_html(_theme_setting(source, *keys))


def _normalize_shopify_resource_link(value: str) -> str:
    if not isinstance(value, str) or not value:
        return ""
    if value.startswith(("https://", "http://")):
        return value
    if value == "shopify://collections":
        return "/collections"
    if value.startswith("shopify://collections/"):
        handle = value.replace("shopify://collections/", "", 1).strip("/")
        return f"/collections/{handle}" if handle else "/collections"
    if value.startswith("shopify://pages/"):
        handle = value.replace("shopify://pages/", "", 1).strip("/")
        return f"/pages/{handle}" if handle else value
    return value


def _collection_handle_from_theme_value(value: str) -> str:
    if not isinstance(value, str) or not value:
        return ""

    normalized = value.strip()
    if normalized in ("shopify://collections", "/collections"):
        return ""
    if normalized.startswith("shopify://collections/"):
        normalized = normalized.replace("shopify://collections/", "", 1)
    elif normalized.startswith("/collections/"):
        normalized = normalized.replace("/collections/", "", 1)
    elif normalized.startswith(("https://", "http://")):
        return ""

    handle = normalized.strip("/").split("?", 1)[0]
    return "" if handle == "all" else handle


async def _get_collection_titles_by_handle(handles: list) -> dict:
    unique_handles = sorted({handle for handle in handles if handle})
    if not unique_handles:
        return {}

    query_parts = []
    aliases_by_handle = {}
    for index, handle in enumerate(unique_handles):
        alias = f"collection{index}"
        aliases_by_handle[handle] = alias
        query_parts.append(f"{alias}: collection(handle: {json.dumps(handle)}) {{ title }}")

    query = f"""
    query GetOccasionCollectionTitles {{
      {' '.join(query_parts)}
    }}
    """

    try:
        data = await shopify_graphql(query)
    except Exception as e:
        logger.error(f"Unable to resolve occasion collection titles: {e}")
        return {}

    return {
        handle: (data.get(alias) or {}).get("title", "")
        for handle, alias in aliases_by_handle.items()
    }


def _normalize_hero(layout: dict) -> list:
    hero = layout.get("hero") or {}
    slides = _theme_blocks_by_type(hero, "slider_item") or _theme_blocks(hero) or [hero]

    return [
        {
            "desktopImage": _theme_setting(slide, "background"),
            "mobileImage": _theme_setting(slide, "mb_background"),
            "subheading": _theme_text(slide, "subheading"),
            "title": _theme_text(slide, "title"),
            "description": _theme_text(slide, "description"),
            "buttonText": _theme_setting(slide, "button_text"),
            "buttonLink": _normalize_shopify_resource_link(_theme_setting(slide, "button_link")),
            "secondButtonText": _theme_setting(slide, "second_button_text"),
            "secondButtonLink": _normalize_shopify_resource_link(_theme_setting(slide, "second_button_link")),
        }
        for slide in slides
        if slide
    ]


async def _normalize_occasions(layout: dict) -> list:
    occasions = layout.get("occasions") or {}
    items = _theme_blocks_by_type(occasions, "collection_block")
    collection_handles = [
        _collection_handle_from_theme_value(_theme_setting(item, "collection"))
        for item in items
    ]
    collection_titles = await _get_collection_titles_by_handle(collection_handles)

    return [
        {
            "collectionHandle": _normalize_shopify_resource_link(_theme_setting(item, "collection")),
            "title": _theme_text(item, "title") or collection_titles.get(_collection_handle_from_theme_value(_theme_setting(item, "collection")), ""),
            "image": _theme_setting(item, "item_image"),
        }
        for item in items
        if item
    ]


def _normalize_promo_banner(layout: dict) -> dict:
    occasions = layout.get("occasions") or {}
    banner_blocks = [block for block in _theme_blocks(occasions) if block.get("type") != "collection_block"]
    promo = layout.get("promoBanner") or {}
    source = banner_blocks[0] if banner_blocks else (_merged_theme_source(promo) if promo else {})

    return {
        "desktopImage": _theme_setting(source, "background", "desktop_image", "image"),
        "mobileImage": _theme_setting(source, "mb_background", "mobile_image"),
        "title": _theme_text(source, "title"),
        "description": _theme_text(source, "description"),
        "buttonText": _theme_setting(source, "button_label", "button_text"),
        "buttonLink": _normalize_shopify_resource_link(_theme_setting(source, "link", "button_link", "collection")),
    }


def _normalize_events_banner(layout: dict) -> dict:
    events = layout.get("eventsBanner") or {}
    source = _merged_theme_source(events) if events else {}

    return {
        "backgroundImage": _theme_setting(source, "background", "background_image", "image", "desktop_image"),
        "rightImage": _theme_setting(source, "right_image", "rightImage", "foreground_image", "side_image"),
        "heading": _theme_text(source, "heading", "title"),
        "subheading": _theme_text(source, "subheading", "sub_heading", "subtitle", "text"),
        "buttonText": _theme_setting(source, "button_text", "buttonText", "button_label", "cta_text"),
        "buttonLink": _normalize_shopify_resource_link(_theme_setting(source, "button_link", "buttonLink", "button_url", "cta_url", "link")),
    }


async def _normalize_homepage_layout(layout: dict) -> dict:
    return {
        "hero": _normalize_hero(layout),
        "occasions": await _normalize_occasions(layout),
        "promoBanner": _normalize_promo_banner(layout),
        "eventsBanner": _normalize_events_banner(layout),
    }


SHOPIFY_ASSET_CACHE_TTL_SECONDS = 600
_SHOPIFY_ASSET_URL_CACHE = {}


def _shopify_asset_cache_now() -> float:
    return datetime.now(timezone.utc).timestamp()


def _is_supported_shopify_asset_reference(value: str) -> bool:
    return isinstance(value, str) and value.startswith(("shopify://shop_images/", "shopify://files/"))


def _shopify_asset_filename(value: str) -> str:
    if not isinstance(value, str) or not value.startswith("shopify://"):
        return ""

    filename = value.rsplit("/", 1)[-1]
    return unquote(filename).strip()


def _shopify_file_search_value(filename: str) -> str:
    return filename.replace("\\", "\\\\").replace('"', '\\"')


def _file_url_from_admin_node(node: dict) -> str:
    if not node:
        return ""

    image = node.get("image")
    if isinstance(image, dict) and image.get("url"):
        return image.get("url", "")

    return node.get("url", "") or ""


def _file_url_filename(value: str) -> str:
    if not isinstance(value, str):
        return ""

    clean_url = value.split("?", 1)[0].split("#", 1)[0]
    filename = clean_url.rsplit("/", 1)[-1]
    return unquote(filename).strip()


def _get_cached_shopify_asset_reference(value: str):
    entry = _SHOPIFY_ASSET_URL_CACHE.get(value)
    if not entry:
        return None

    if entry.get("expires_at", 0) <= _shopify_asset_cache_now():
        _SHOPIFY_ASSET_URL_CACHE.pop(value, None)
        return None

    return entry.get("url", "")


def _cache_shopify_asset_reference(value: str, resolved_url: str) -> None:
    if not _is_supported_shopify_asset_reference(value):
        return

    _SHOPIFY_ASSET_URL_CACHE[value] = {
        "url": resolved_url or "",
        "expires_at": _shopify_asset_cache_now() + SHOPIFY_ASSET_CACHE_TTL_SECONDS,
    }


def _collect_homepage_asset_references(layout: dict) -> set:
    references = set()

    for slide in layout.get("hero", []):
        references.update([
            slide.get("desktopImage", ""),
            slide.get("mobileImage", ""),
        ])

    for occasion in layout.get("occasions", []):
        references.add(occasion.get("image", ""))

    promo = layout.get("promoBanner", {})
    references.update([
        promo.get("desktopImage", ""),
        promo.get("mobileImage", ""),
    ])

    events = layout.get("eventsBanner", {})
    references.update([
        events.get("backgroundImage", ""),
        events.get("rightImage", ""),
    ])

    return {
        reference
        for reference in references
        if _is_supported_shopify_asset_reference(reference)
    }


async def _resolve_shopify_asset_references(values: set) -> dict:
    resolved_assets = {}
    unresolved_refs = []

    for value in sorted(values):
        cached_url = _get_cached_shopify_asset_reference(value)
        if cached_url is None:
            unresolved_refs.append(value)
        else:
            resolved_assets[value] = cached_url

    if not unresolved_refs:
        return resolved_assets

    filenames_by_ref = {
        value: _shopify_asset_filename(value)
        for value in unresolved_refs
    }
    filenames = sorted({
        filename
        for filename in filenames_by_ref.values()
        if filename
    })

    resolved_by_filename = {}
    if filenames:
        file_fields = """
          nodes {
            ... on MediaImage {
              image {
                url
              }
            }
            ... on GenericFile {
              url
            }
          }
        """
        query_parts = []
        aliases_by_filename = {}
        for index, filename in enumerate(filenames):
            safe_filename = _shopify_file_search_value(filename)
            exact_query = f'filename:"{safe_filename}"'
            exact_alias = f"file{index}Exact"
            fallback_alias = f"file{index}Fallback"
            aliases_by_filename[filename] = (exact_alias, fallback_alias)
            query_parts.extend([
                f'{exact_alias}: files(first: 1, query: {json.dumps(exact_query)}) {{ {file_fields} }}',
                f'{fallback_alias}: files(first: 1, query: {json.dumps(safe_filename)}) {{ {file_fields} }}',
            ])

        query = f"""
        query ResolveShopifyFiles {{
          {' '.join(query_parts)}
        }}
        """

        try:
            data = await shopify_admin_graphql(query)
            for filename, aliases in aliases_by_filename.items():
                exact_alias, fallback_alias = aliases
                exact_nodes = data.get(exact_alias, {}).get("nodes", [])
                fallback_nodes = data.get(fallback_alias, {}).get("nodes", [])
                resolved_url = (
                    _file_url_from_admin_node(exact_nodes[0] if exact_nodes else {})
                    or _file_url_from_admin_node(fallback_nodes[0] if fallback_nodes else {})
                )
                if resolved_url:
                    resolved_by_filename[filename] = resolved_url
                    resolved_by_filename[filename.lower()] = resolved_url
        except Exception as e:
            logger.error(f"Unable to resolve Shopify asset references: {e}")

    for value, filename in filenames_by_ref.items():
        resolved_url = ""
        if filename:
            resolved_url = (
                resolved_by_filename.get(filename)
                or resolved_by_filename.get(filename.lower())
                or ""
            )

        resolved_assets[value] = resolved_url
        _cache_shopify_asset_reference(value, resolved_url)

    return resolved_assets


def _resolve_shopify_asset_reference(value: str, cache: dict) -> str:
    if not value:
        return ""
    if isinstance(value, str) and value.startswith(("https://", "http://")):
        return value
    if not _is_supported_shopify_asset_reference(value):
        return ""
    return cache.get(value, "")


async def _resolve_homepage_layout_images(layout: dict) -> dict:
    cache = await _resolve_shopify_asset_references(_collect_homepage_asset_references(layout))

    for slide in layout.get("hero", []):
        slide["desktopImage"] = _resolve_shopify_asset_reference(slide.get("desktopImage", ""), cache)
        slide["mobileImage"] = _resolve_shopify_asset_reference(slide.get("mobileImage", ""), cache)

    for occasion in layout.get("occasions", []):
        occasion["image"] = _resolve_shopify_asset_reference(occasion.get("image", ""), cache)

    promo = layout.get("promoBanner", {})
    promo["desktopImage"] = _resolve_shopify_asset_reference(promo.get("desktopImage", ""), cache)
    promo["mobileImage"] = _resolve_shopify_asset_reference(promo.get("mobileImage", ""), cache)

    events = layout.get("eventsBanner", {})
    events["backgroundImage"] = _resolve_shopify_asset_reference(events.get("backgroundImage", ""), cache)
    events["rightImage"] = _resolve_shopify_asset_reference(events.get("rightImage", ""), cache)

    return layout


async def _get_theme_file_content(file_node: dict) -> str:
    body = (file_node or {}).get("body") or {}
    body_type = body.get("__typename")

    if body_type == "OnlineStoreThemeFileBodyText":
        return body.get("content", "")
    if body_type == "OnlineStoreThemeFileBodyBase64":
        content = body.get("contentBase64", "")
        return base64.b64decode(content).decode("utf-8") if content else ""
    if body_type == "OnlineStoreThemeFileBodyUrl":
        url = body.get("url")
        if not url:
            raise HTTPException(status_code=502, detail="Theme file body URL missing")
        try:
            async with httpx.AsyncClient(timeout=15) as client_http:
                response = await client_http.get(url)
                response.raise_for_status()
                return response.text
        except httpx.RequestError as e:
            logger.error(f"Theme file body URL network error: {e}")
            raise HTTPException(status_code=503, detail="Theme file body unavailable")
        except httpx.HTTPStatusError as e:
            logger.error(f"Theme file body URL HTTP error: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=502, detail="Theme file body fetch failed")

    raise HTTPException(status_code=502, detail="Unsupported theme file body type")


async def _get_active_theme_homepage_template() -> dict:
    query = """
    query GetActiveThemeHomepageTemplate($filenames: [String!]) {
      themes(first: 1, roles: [MAIN]) {
        nodes {
          files(first: 1, filenames: $filenames) {
            nodes {
              filename
              body {
                __typename
                ... on OnlineStoreThemeFileBodyText {
                  content
                }
                ... on OnlineStoreThemeFileBodyBase64 {
                  contentBase64
                }
                ... on OnlineStoreThemeFileBodyUrl {
                  url
                }
              }
            }
          }
        }
      }
    }
    """
    data = await shopify_admin_graphql(query, {"filenames": [HOMEPAGE_TEMPLATE_FILE]})
    themes = data.get("themes", {}).get("nodes", [])
    if not themes:
        raise HTTPException(status_code=404, detail="Active Shopify theme not found")

    files = themes[0].get("files", {}).get("nodes", [])
    if not files:
        raise HTTPException(status_code=404, detail=f"{HOMEPAGE_TEMPLATE_FILE} not found in active theme")

    content = await _get_theme_file_content(files[0])

    # Shopify prepends a comment block to generated JSON templates.
    # Remove it before parsing.
    comment_end = content.find("*/")

    if comment_end != -1:
        content = content[comment_end + 2:].lstrip()

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid {HOMEPAGE_TEMPLATE_FILE}: {e}")
        raise HTTPException(status_code=502, detail="Invalid homepage theme template JSON")


# ─── Auth Models ───
class CartLineInput(BaseModel):
    variantId: str
    quantity: int = 1

class CartAttributeInput(BaseModel):
    key: str
    value: str

class CreateCartReq(BaseModel):
    lines: List[CartLineInput]
    attributes: Optional[List[CartAttributeInput]] = None


# ─── Auth Routes ───
# ─── Shopify Collections ───
@api_router.get("/collections")
async def get_collections(featured_only: bool = False):
    query = """
    {
      collections(first: 30) {
        edges {
          node {
            id handle title description
            image { url }
          }
        }
      }
    }
    """
    data = await shopify_graphql(query)
    collections = [
        transform_collection(edge["node"])
        for edge in data.get("collections", {}).get("edges", [])
        if edge["node"]["handle"] not in HIDDEN_COLLECTIONS
    ]
    if featured_only:
        featured_set = set(FEATURED_COLLECTIONS)
        collections = [c for c in collections if c["handle"] in featured_set]
        collections.sort(key=lambda c: FEATURED_COLLECTIONS.index(c["handle"]) if c["handle"] in FEATURED_COLLECTIONS else 99)
    return {"collections": collections}


@api_router.get("/collections/{handle}")
async def get_collection(handle: str, first: int = 30):
    query = """
    query($handle: String!, $first: Int!) {
      collection(handle: $handle) {
        id handle title description
        image { url }
        products(first: $first) {
          edges {
            node {
              id handle title description availableForSale tags
              priceRange { minVariantPrice { amount currencyCode } }
              images(first: 5) { edges { node { url altText } } }
              variants(first: 5) { edges { node { id title priceV2: price { amount currencyCode } availableForSale } } }
              collections(first: 3) { edges { node { handle title } } }
            }
          }
        }
      }
    }
    """
    data = await shopify_graphql(query, {"handle": handle, "first": first})
    collection = data.get("collection")
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    products = [transform_product(edge["node"]) for edge in collection.get("products", {}).get("edges", [])]
    return {
        "collection": transform_collection(collection),
        "products": products,
    }


# ─── Shopify Products ───
@api_router.get("/products")
async def get_products(search: Optional[str] = None, first: int = 30, collection: Optional[str] = None):
    if collection:
        result = await get_collection(collection, first)
        return {"products": result["products"]}

    if search:
        query = """
        query($query: String!, $first: Int!) {
          products(first: $first, query: $query) {
            edges {
              node {
                id handle title description availableForSale tags
                priceRange { minVariantPrice { amount currencyCode } }
                images(first: 3) { edges { node { url altText } } }
                variants(first: 3) { edges { node { id title priceV2: price { amount currencyCode } availableForSale } } }
                collections(first: 3) { edges { node { handle title } } }
              }
            }
          }
        }
        """
        data = await shopify_graphql(query, {"query": search, "first": first})
    else:
        query = """
        query($first: Int!) {
          products(first: $first) {
            edges {
              node {
                id handle title description availableForSale tags
                priceRange { minVariantPrice { amount currencyCode } }
                images(first: 3) { edges { node { url altText } } }
                variants(first: 3) { edges { node { id title priceV2: price { amount currencyCode } availableForSale } } }
                collections(first: 3) { edges { node { handle title } } }
              }
            }
          }
        }
        """
        data = await shopify_graphql(query, {"first": first})

    products = [transform_product(edge["node"]) for edge in data.get("products", {}).get("edges", [])]
    return {"products": products}


@api_router.get("/products/{handle}")
async def get_product(handle: str):
    query = """
    query($handle: String!) {
      product(handle: $handle) {
        id handle title description availableForSale tags
        priceRange { minVariantPrice { amount currencyCode } }
        images(first: 10) { edges { node { url altText } } }
        variants(first: 10) { edges { node { id title priceV2: price { amount currencyCode } availableForSale } } }
        collections(first: 5) { edges { node { handle title } } }
      }
    }
    """
    data = await shopify_graphql(query, {"handle": handle})
    product = data.get("product")
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return transform_product(product)


# ─── Shopify Cart / Checkout ───
@api_router.post("/cart/create")
async def create_cart(req: CreateCartReq):
    lines = [{"merchandiseId": line.variantId, "quantity": line.quantity} for line in req.lines]
    cart_input = {"lines": lines}
    if req.attributes:
        cart_input["attributes"] = [{"key": attr.key, "value": attr.value} for attr in req.attributes]
        
    mutation = """
    mutation($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
          cost { totalAmount { amount currencyCode } }
        }
        userErrors { field message }
      }
    }
    """
    data = await shopify_graphql(mutation, {"input": cart_input})
    cart_data = data.get("cartCreate", {})
    errors = cart_data.get("userErrors", [])
    if errors:
        raise HTTPException(status_code=400, detail=errors[0].get("message", "Cart creation failed"))

    cart = cart_data.get("cart", {})
    return {
        "cart_id": cart.get("id", ""),
        "checkout_url": cart.get("checkoutUrl", ""),
        "total": float(cart.get("cost", {}).get("totalAmount", {}).get("amount", 0)),
        "currency": cart.get("cost", {}).get("totalAmount", {}).get("currencyCode", "AED"),
    }


# ─── Shopify Customer Auth ───
class ShopifyLoginReq(BaseModel):
    email: str
    password: str

class ShopifyRegisterReq(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str = ""
    phone: str = ""

@api_router.post("/shopify-auth/register")
async def shopify_register(req: ShopifyRegisterReq):
    mutation = """
    mutation($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        customer { id firstName lastName email phone }
        customerUserErrors { code field message }
      }
    }
    """
    variables = {"input": {
        "email": req.email, "password": req.password,
        "firstName": req.first_name, "lastName": req.last_name or req.first_name,
    }}
    if req.phone:
        variables["input"]["phone"] = req.phone
    data = await shopify_graphql(mutation, variables)
    result = data.get("customerCreate", {})
    errors = result.get("customerUserErrors", [])
    if errors:
        raise HTTPException(status_code=400, detail=errors[0].get("message", "Registration failed"))
    # Auto-login after register
    return await shopify_login(ShopifyLoginReq(email=req.email, password=req.password))

@api_router.post("/shopify-auth/login")
async def shopify_login(req: ShopifyLoginReq):
    mutation = """
    mutation($input: CustomerAccessTokenCreateInput!) {
      customerAccessTokenCreate(input: $input) {
        customerAccessToken { accessToken expiresAt }
        customerUserErrors { code field message }
      }
    }
    """
    data = await shopify_graphql(mutation, {"input": {"email": req.email, "password": req.password}})
    result = data.get("customerAccessTokenCreate", {})
    errors = result.get("customerUserErrors", [])
    if errors:
        raise HTTPException(status_code=401, detail=errors[0].get("message", "Invalid credentials"))
    token_data = result.get("customerAccessToken", {})
    if not token_data:
        raise HTTPException(status_code=401, detail="Login failed")
    customer_token = token_data["accessToken"]
    profile = await _get_shopify_customer(customer_token)
    email = req.email.lower().strip()
    return {
        "shopify_customer_token": customer_token,
        "user": {
            "id": profile.get("id", ""), "name": (profile.get("firstName", "") + " " + profile.get("lastName", "")).strip(),
            "email": email, "phone": profile.get("phone", ""), "role": "customer",
        }
    }

async def _get_shopify_customer(customer_token: str) -> dict:
    query = """
    query($token: String!) {
      customer(customerAccessToken: $token) {
        id firstName lastName email phone
        defaultAddress { address1 city province country zip }
      }
    }
    """
    data = await shopify_graphql(query, {"token": customer_token})
    return data.get("customer", {})

async def _authenticate_shopify_customer(shopify_token: Optional[str]) -> dict:
    if not shopify_token:
        raise HTTPException(status_code=401, detail="Shopify customer token required")
    profile = await _get_shopify_customer(shopify_token)
    if not profile or not profile.get("id"):
        raise HTTPException(status_code=401, detail="Invalid or expired customer token")
    return profile

@api_router.get("/shopify-auth/orders")
async def get_shopify_orders(shopify_token: str = Header(alias="x-shopify-customer-token")):
    if not shopify_token:
        raise HTTPException(status_code=401, detail="Shopify customer token required")
    query = """
    query($token: String!) {
      customer(customerAccessToken: $token) {
        orders(first: 20, sortKey: PROCESSED_AT, reverse: true) {
          edges {
            node {
              id name orderNumber processedAt
              financialStatus fulfillmentStatus
              totalPrice { amount currencyCode }
              lineItems(first: 10) {
                edges {
                  node {
                    title quantity
                    variant { image { url } price { amount currencyCode } }
                  }
                }
              }
              shippingAddress { address1 city province country }
            }
          }
        }
      }
    }
    """
    data = await shopify_graphql(query, {"token": shopify_token})
    customer = data.get("customer")
    if not customer:
        raise HTTPException(status_code=401, detail="Invalid or expired customer token")
    orders = []
    for edge in customer.get("orders", {}).get("edges", []):
        node = edge["node"]
        items = []
        for li_edge in node.get("lineItems", {}).get("edges", []):
            li = li_edge["node"]
            variant = li.get("variant") or {}
            items.append({
                "title": li["title"], "quantity": li["quantity"],
                "price": float(variant.get("price", {}).get("amount", 0)),
                "image": (variant.get("image") or {}).get("url", ""),
            })
        orders.append({
            "id": node["id"], "name": node["name"], "order_number": node.get("orderNumber"),
            "processed_at": node.get("processedAt", ""),
            "financial_status": node.get("financialStatus", ""),
            "fulfillment_status": node.get("fulfillmentStatus", ""),
            "total": float(node.get("totalPrice", {}).get("amount", 0)),
            "currency": node.get("totalPrice", {}).get("currencyCode", "AED"),
            "items": items,
            "shipping_address": node.get("shippingAddress"),
        })
    return {"orders": orders}


# ─── Push Notifications ───
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

class PushTokenReq(BaseModel):
    expo_token: str
    platform: Optional[str] = None

class PushSendReq(BaseModel):
    customer_id: str
    title: str
    body: str
    data: Optional[dict] = None

@api_router.post("/push/register")
async def register_push_token(
    req: PushTokenReq,
    shopify_token: str = Header(alias="x-shopify-customer-token")
):
    profile = await _authenticate_shopify_customer(shopify_token)
    customer_id = profile["id"]
    customer_email = profile.get("email", "")

    # Store token in Supabase
    headers = {
        "Prefer": "resolution=merge-duplicates"
    }
    params = {
        "on_conflict": "expo_token"
    }
    payload = {
        "customer_id": customer_id,
        "expo_token": req.expo_token,
        "platform": req.platform or "unknown",
        "customer_email": customer_email,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    response = await _supabase_request(
        "POST",
        "/rest/v1/push_tokens",
        json_data=payload,
        params=params,
        headers=headers
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=500, detail="Failed to register push token in storage")

    return {"status": "registered"}

@api_router.delete("/push/unregister")
async def unregister_push_token(
    expo_token: Optional[str] = None,
    shopify_token: str = Header(alias="x-shopify-customer-token")
):
    profile = await _authenticate_shopify_customer(shopify_token)
    customer_id = profile["id"]

    params = {
        "customer_id": f"eq.{customer_id}"
    }
    if expo_token:
        params["expo_token"] = f"eq.{expo_token}"

    response = await _supabase_request(
        "DELETE",
        "/rest/v1/push_tokens",
        params=params
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=500, detail="Failed to unregister push token in storage")

    return {"status": "unregistered"}

@api_router.post("/push/send")
async def send_push_notification(req: PushSendReq):
    # Fetch tokens from Supabase for this customer_id
    params = {
        "customer_id": f"eq.{req.customer_id}"
    }
    response = await _supabase_request("GET", "/rest/v1/push_tokens", params=params)
    if response.status_code >= 400:
        raise HTTPException(status_code=500, detail="Failed to retrieve push tokens")

    tokens = response.json()
    if not tokens:
        return {"sent": 0}

    messages = [
        {"to": t["expo_token"], "title": req.title, "body": req.body, "data": req.data or {}, "sound": "default"}
        for t in tokens if t.get("expo_token", "").startswith("ExponentPushToken")
    ]
    if messages:
        async with httpx.AsyncClient(timeout=10) as http:
            expo_response = await http.post(
            EXPO_PUSH_URL,
            json=messages,
            headers={"Content-Type": "application/json"}
        )

        logger.info(f"Expo Push Status: {expo_response.status_code}")
        logger.info(f"Expo Push Response: {expo_response.text}")

    return {"sent": len(messages)}

# ─── Shopify Cart with Customer ───
# Admin notification management
ADMIN_COOKIE_NAME = "floarea_admin_session"

def _admin_signature(username: str) -> str:
    secret = os.environ.get("ADMIN_SESSION_SECRET", "")
    return hmac.new(secret.encode("utf-8"), username.encode("utf-8"), hashlib.sha256).hexdigest()

def _admin_cookie_value(username: str) -> str:
    return f"{username}:{_admin_signature(username)}"

def _is_admin_authenticated(request: Request) -> bool:
    secret = os.environ.get("ADMIN_SESSION_SECRET", "")
    if not secret:
        logger.error("ADMIN_SESSION_SECRET is not configured")
        return False

    cookie_value = request.cookies.get(ADMIN_COOKIE_NAME, "")
    if ":" not in cookie_value:
        return False

    username, signature = cookie_value.split(":", 1)
    expected_username = os.environ.get("ADMIN_USERNAME", "")
    expected_signature = _admin_signature(username)
    return (
        bool(expected_username)
        and hmac.compare_digest(username, expected_username)
        and hmac.compare_digest(signature, expected_signature)
    )

def _admin_redirect() -> RedirectResponse:
    return RedirectResponse(url="/admin/login", status_code=303)

async def _get_notification_campaigns(limit: int = 50) -> list:
    params = {
        "select": "*",
        "order": "sent_at.desc",
        "limit": str(limit),
    }
    response = await _supabase_request("GET", "/rest/v1/notification_campaigns", params=params)
    if response.status_code >= 400:
        raise HTTPException(status_code=500, detail="Failed to retrieve notification history")
    return response.json()

async def _get_hero_slides() -> list:
    query = """
    query GetHeroSlides {
      metaobjects(type: "hero_slide", first: 50) {
        edges {
          node {
            id
            handle
            fields {
              key
              value
              reference {
                ... on MediaImage {
                  image {
                    url
                  }
                }
              }
            }
          }
        }
      }
    }
    """
    try:
        data = await shopify_graphql(query)
    except Exception as e:
        logger.error(f"Error querying Shopify hero slides: {e}")
        return []

    edges = data.get("metaobjects", {}).get("edges", [])
    slides = []
    for edge in edges:
        node = edge.get("node", {})
        if not node:
            continue
        transformed = transform_metaobject_fields(node)
        
        # Check active status
        active_val = transformed.get("active", "false")
        if isinstance(active_val, bool):
            is_active = active_val
        elif isinstance(active_val, str):
            is_active = active_val.lower() == "true"
        else:
            is_active = bool(active_val)
            
        if not is_active:
            continue
            
        # Parse sort order
        sort_val = transformed.get("sort_order")
        try:
            sort_order = int(sort_val) if sort_val is not None else 0
        except (ValueError, TypeError):
            sort_order = 0
            
        slides.append({
            "overline": transformed.get("overline", ""),
            "title": transformed.get("title", ""),
            "subtitle": transformed.get("subtitle", ""),
            "cta_text": transformed.get("cta_text", ""),
            "cta_url": transformed.get("cta_url", ""),
            "desktop_image": transformed.get("desktop_image", ""),
            "mobile_image": transformed.get("mobile_image", ""),
            "active": is_active,
            "sort_order": sort_order,
            "id": transformed.get("id"),
            "handle": transformed.get("handle")
        })
        
    slides.sort(key=lambda s: s["sort_order"])
    return slides


async def _get_promo_banner() -> dict:
    query = """
    query GetPromoBanner {
      metaobjects(type: "promo_banner", first: 10) {
        edges {
          node {
            id
            handle
            fields {
              key
              value
              reference {
                ... on MediaImage {
                  image {
                    url
                  }
                }
              }
            }
          }
        }
      }
    }
    """
    try:
        data = await shopify_graphql(query)
    except Exception as e:
        logger.error(f"Error querying Shopify promo banner: {e}")
        return {}

    edges = data.get("metaobjects", {}).get("edges", [])
    for edge in edges:
        node = edge.get("node", {})
        if not node:
            continue
        transformed = transform_metaobject_fields(node)
        
        active_val = transformed.get("active", "false")
        if isinstance(active_val, bool):
            is_active = active_val
        elif isinstance(active_val, str):
            is_active = active_val.lower() == "true"
        else:
            is_active = bool(active_val)
            
        if not is_active:
            continue
            
        return {
            "overline": transformed.get("overline", ""),
            "title": transformed.get("title", ""),
            "subtitle": transformed.get("subtitle", ""),
            "cta_text": transformed.get("cta_text", ""),
            "cta_url": transformed.get("cta_url", ""),
            "desktop_image": transformed.get("desktop_image", ""),
            "mobile_image": transformed.get("mobile_image", ""),
            "active": is_active
        }
    return {}


async def _get_generic_banner(banner_type: str) -> dict:
    query = f"""
    query GetGenericBanner {{
      metaobjects(type: "{banner_type}", first: 10) {{
        edges {{
          node {{
            id
            handle
            fields {{
              key
              value
              reference {{
                ... on MediaImage {{
                  image {{
                    url
                  }}
                }}
              }}
            }}
          }}
        }}
      }}
    }}
    """
    try:
        data = await shopify_graphql(query)
    except Exception as e:
        logger.error(f"Error querying Shopify {banner_type} banner: {e}")
        return {}

    edges = data.get("metaobjects", {}).get("edges", [])
    for edge in edges:
        node = edge.get("node", {})
        if not node:
            continue
        transformed = transform_metaobject_fields(node)
        
        active_val = transformed.get("active", "false")
        if isinstance(active_val, bool):
            is_active = active_val
        elif isinstance(active_val, str):
            is_active = active_val.lower() == "true"
        else:
            is_active = bool(active_val)
            
        if not is_active:
            continue
            
        return {
            "title": transformed.get("title", ""),
            "subtitle": transformed.get("subtitle", ""),
            "cta_text": transformed.get("cta_text", ""),
            "desktop_image": transformed.get("desktop_image", ""),
            "mobile_image": transformed.get("mobile_image", ""),
            "active": is_active
        }
    return {}


async def _get_events_banner() -> dict:
    return await _get_generic_banner("events_banner")


async def _get_custom_gift_banner() -> dict:
    return await _get_generic_banner("custom_gift_banner")

async def _record_notification_campaign(
    title: str,
    body: str,
    customer_count: int,
    device_count: int,
    success_count: int,
    failed_count: int,
    status: str
) -> None:
    payload = {
        "title": title,
        "body": body,
        "recipient_count": device_count,
        "customer_count": customer_count,
        "device_count": device_count,
        "success_count": success_count,
        "failed_count": failed_count,
        "status": status,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    response = await _supabase_request("POST", "/rest/v1/notification_campaigns", json_data=payload)
    if response.status_code >= 400:
        raise HTTPException(status_code=500, detail="Failed to store notification campaign")

async def _remove_invalid_push_token(expo_token: str) -> None:
    response = await _supabase_request(
        "DELETE",
        "/rest/v1/push_tokens",
        params={"expo_token": f"eq.{expo_token}"}
    )
    if response.status_code >= 400:
        logger.error(f"Failed to remove invalid Expo token: {expo_token}")

async def _send_expo_notifications_to_tokens(
    tokens: list,
    title: str,
    body: str,
    data: Optional[dict] = None,
    log_context: str = "Expo Push"
) -> tuple[int, int, int, str]:
    valid_tokens = [
        {"customer_id": t.get("customer_id"), "expo_token": t.get("expo_token")}
        for t in tokens
        if t.get("expo_token", "").startswith("ExponentPushToken")
    ]
    device_count = len(valid_tokens)
    if not valid_tokens:
        return 0, 0, 0, "failed"

    success_count = 0
    failed_count = 0
    async with httpx.AsyncClient(timeout=10) as http:
        for i in range(0, len(valid_tokens), 100):
            batch_tokens = valid_tokens[i:i + 100]
            batch_messages = [
                {"to": t["expo_token"], "title": title, "body": body, "data": data or {}, "sound": "default"}
                for t in batch_tokens
            ]
            expo_response = await http.post(
                EXPO_PUSH_URL,
                json=batch_messages,
                headers={"Content-Type": "application/json"}
            )
            logger.info(f"{log_context} Status: {expo_response.status_code}")
            logger.info(f"{log_context} Response: {expo_response.text}")

            try:
                expo_payload = expo_response.json()
            except ValueError:
                failed_count += len(batch_tokens)
                continue

            tickets = expo_payload.get("data") if isinstance(expo_payload, dict) else None
            if not isinstance(tickets, list):
                failed_count += len(batch_tokens)
                continue

            for token_data, ticket in zip(batch_tokens, tickets):
                if ticket.get("status") == "ok":
                    success_count += 1
                    continue

                failed_count += 1
                details = ticket.get("details") or {}
                if details.get("error") == "DeviceNotRegistered":
                    await _remove_invalid_push_token(token_data["expo_token"])

            if len(tickets) < len(batch_tokens):
                failed_count += len(batch_tokens) - len(tickets)

    if success_count == device_count:
        status = "sent"
    elif success_count > 0:
        status = "partial"
    else:
        status = "failed"

    return device_count, success_count, failed_count, status

async def _send_campaign_notification(title: str, body: str) -> tuple[int, int, int, int, str]:
    response = await _supabase_request("GET", "/rest/v1/push_tokens", params={"select": "customer_id,expo_token"})
    if response.status_code >= 400:
        raise HTTPException(status_code=500, detail="Failed to retrieve push tokens")

    tokens = response.json()
    valid_tokens = [t for t in tokens if t.get("expo_token", "").startswith("ExponentPushToken")]
    customer_count = len({t["customer_id"] for t in valid_tokens if t.get("customer_id")})
    device_count, success_count, failed_count, status = await _send_expo_notifications_to_tokens(
        valid_tokens,
        title,
        body,
        log_context="Expo Campaign Push"
    )

    return customer_count, device_count, success_count, failed_count, status

async def verify_shopify_webhook(request: Request, shopify_hmac: Optional[str]) -> dict:
    raw_body = await request.body()
    if not SHOPIFY_WEBHOOK_SECRET or not shopify_hmac:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    digest = hmac.new(
        SHOPIFY_WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).digest()
    calculated_hmac = base64.b64encode(digest).decode("utf-8")
    if not hmac.compare_digest(calculated_hmac, shopify_hmac.strip()):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        return json.loads(raw_body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")

def _shopify_customer_gid(customer_id: Optional[object]) -> Optional[str]:
    if customer_id is None:
        return None
    customer_id_str = str(customer_id).strip()
    if not customer_id_str:
        return None
    if customer_id_str.startswith("gid://shopify/Customer/"):
        return customer_id_str
    return f"gid://shopify/Customer/{customer_id_str}"

def _extract_webhook_customer_id(payload: dict) -> Optional[object]:
    customer = payload.get("customer")
    if isinstance(customer, dict) and customer.get("id"):
        return customer.get("id")

    if payload.get("customer_id"):
        return payload.get("customer_id")

    order = payload.get("order")
    if isinstance(order, dict):
        order_customer = order.get("customer")
        if isinstance(order_customer, dict) and order_customer.get("id"):
            return order_customer.get("id")
        if order.get("customer_id"):
            return order.get("customer_id")

    return None

async def send_notification_to_customer(
    customer_id: Optional[object],
    title: str,
    body: str,
    webhook_type: str
) -> dict:
    customer_gid = _shopify_customer_gid(customer_id)
    if not customer_gid:
        logger.info(f"{webhook_type}: missing customer id; no notification sent")
        return {"sent": 0, "success": 0, "failed": 0, "status": "skipped"}

    response = await _supabase_request(
        "GET",
        "/rest/v1/push_tokens",
        params={"select": "customer_id,expo_token", "customer_id": f"eq.{customer_gid}"}
    )
    if response.status_code >= 400:
        logger.error(f"{webhook_type}: failed to retrieve push tokens for customer {customer_gid}")
        return {"sent": 0, "success": 0, "failed": 0, "status": "token_lookup_failed"}

    tokens = response.json()
    token_count = len([t for t in tokens if t.get("expo_token", "").startswith("ExponentPushToken")])
    if token_count == 0:
        logger.info(f"{webhook_type}: customer {customer_gid}; token_count=0; no notification sent")
        return {"sent": 0, "success": 0, "failed": 0, "status": "no_tokens"}

    device_count, success_count, failed_count, status = await _send_expo_notifications_to_tokens(
        tokens,
        title,
        body,
        data={"type": webhook_type},
        log_context=f"Shopify {webhook_type} Push"
    )
    logger.info(
        f"{webhook_type}: customer {customer_gid}; token_count={token_count}; "
        f"sent={device_count}; success={success_count}; failed={failed_count}; status={status}"
    )
    return {"sent": device_count, "success": success_count, "failed": failed_count, "status": status}

async def _handle_shopify_transactional_webhook(
    request: Request,
    shopify_hmac: Optional[str],
    webhook_type: str,
    title: str,
    body: str
) -> dict:
    payload = await verify_shopify_webhook(request, shopify_hmac)
    customer_id = _extract_webhook_customer_id(payload)
    result = await send_notification_to_customer(customer_id, title, body, webhook_type)
    return {"status": "ok", "notification": result}

@app.post("/webhooks/orders/create")
async def webhook_orders_create(
    request: Request,
    shopify_hmac: Optional[str] = Header(default=None, alias="X-Shopify-Hmac-Sha256")
):
    return await _handle_shopify_transactional_webhook(
        request,
        shopify_hmac,
        "orders/create",
        "🌹 Order Received",
        "Your order has been received and is being prepared."
    )

@app.post("/webhooks/fulfillments/create")
async def webhook_fulfillments_create(
    request: Request,
    shopify_hmac: Optional[str] = Header(default=None, alias="X-Shopify-Hmac-Sha256")
):
    return await _handle_shopify_transactional_webhook(
        request,
        shopify_hmac,
        "fulfillments/create",
        "🚚 Order On The Way",
        "Your flowers are on the way."
    )

@app.post("/webhooks/orders/cancelled")
async def webhook_orders_cancelled(
    request: Request,
    shopify_hmac: Optional[str] = Header(default=None, alias="X-Shopify-Hmac-Sha256")
):
    return await _handle_shopify_transactional_webhook(
        request,
        shopify_hmac,
        "orders/cancelled",
        "⚠️ Order Cancelled",
        "Your order has been cancelled. Please contact support if needed."
    )

@app.post("/webhooks/refunds/create")
async def webhook_refunds_create(
    request: Request,
    shopify_hmac: Optional[str] = Header(default=None, alias="X-Shopify-Hmac-Sha256")
):
    return await _handle_shopify_transactional_webhook(
        request,
        shopify_hmac,
        "refunds/create",
        "💳 Refund Processed",
        "A refund has been issued for your order."
    )

@app.get("/admin/login")
async def admin_login_page(request: Request):
    if _is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    return templates.TemplateResponse(
        request=request,
        name="admin/login.html",
        context={"error": None},
    )

@app.post("/admin/login")
async def admin_login(request: Request, username: str = Form(...), password: str = Form(...)):
    expected_username = os.environ.get("ADMIN_USERNAME", "")
    expected_password = os.environ.get("ADMIN_PASSWORD", "")
    session_secret = os.environ.get("ADMIN_SESSION_SECRET", "")

    is_valid = (
        expected_username
        and expected_password
        and session_secret
        and hmac.compare_digest(username, expected_username)
        and hmac.compare_digest(password, expected_password)
    )
    if not is_valid:
        return templates.TemplateResponse(
            request=request,
            name="admin/login.html",
            context={"error": "Invalid username or password"},
            status_code=401
        )

    response = RedirectResponse(url="/admin", status_code=303)
    response.set_cookie(
        ADMIN_COOKIE_NAME,
        _admin_cookie_value(username),
        httponly=True,
        secure=_IS_PRODUCTION,
        samesite="lax",
        max_age=60 * 60 * 12,
        path="/admin",  # Restrict cookie to admin paths only
    )
    return response

@app.post("/admin/logout")
async def admin_logout():
    response = RedirectResponse(url="/admin/login", status_code=303)
    response.delete_cookie(ADMIN_COOKIE_NAME)
    return response

@app.get("/admin")
async def admin_dashboard(
    request: Request,
    message: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
):
    if not _is_admin_authenticated(request):
        return _admin_redirect()
    campaigns = await _get_notification_campaigns()
    return templates.TemplateResponse(
        request=request,
        name="admin/dashboard.html",
        context={"campaigns": campaigns, "message": message, "error": error}
    )

# (Admin hero routes removed)

@app.post("/admin/notifications/send")
async def admin_send_notification(request: Request, title: str = Form(...), body: str = Form(...)):
    if not _is_admin_authenticated(request):
        return _admin_redirect()

    try:
        clean_title = title.strip()
        clean_body = body.strip()

        # Validate notification content
        if not clean_title:
            return RedirectResponse(url="/admin?error=Notification+title+is+required", status_code=303)
        if not clean_body:
            return RedirectResponse(url="/admin?error=Notification+body+is+required", status_code=303)
        if len(clean_title) > 120:
            return RedirectResponse(url="/admin?error=Title+must+be+120+characters+or+fewer", status_code=303)
        if len(clean_body) > 500:
            return RedirectResponse(url="/admin?error=Body+must+be+500+characters+or+fewer", status_code=303)

        customer_count, device_count, success_count, failed_count, status = await _send_campaign_notification(clean_title, clean_body)
        await _record_notification_campaign(
            clean_title,
            clean_body,
            customer_count,
            device_count,
            success_count,
            failed_count,
            status
        )
        message = quote(f"Notification sent to {success_count} of {device_count} devices")
        return RedirectResponse(url=f"/admin?message={message}", status_code=303)
    except Exception as e:
        logger.error(f"Admin notification send failed: {e}")
        return RedirectResponse(url="/admin?error=Failed+to+send+notification", status_code=303)

@app.get("/admin/export")
async def admin_export(request: Request):
    if not _is_admin_authenticated(request):
        return _admin_redirect()

    try:
        from openpyxl import Workbook

        campaigns = await _get_notification_campaigns(limit=10000)
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Notification Campaigns"
        sheet.append(["ID", "Title", "Body", "Recipients", "Customers", "Devices", "Success", "Failed", "Status", "Sent At"])

        for campaign in campaigns:
            sheet.append([
                campaign.get("id", ""),
                campaign.get("title", ""),
                campaign.get("body", ""),
                campaign.get("recipient_count", 0),
                campaign.get("customer_count", 0),
                campaign.get("device_count", campaign.get("recipient_count", 0)),
                campaign.get("success_count", 0),
                campaign.get("failed_count", 0),
                campaign.get("status", ""),
                campaign.get("sent_at", ""),
            ])

        stream = BytesIO()
        workbook.save(stream)
        stream.seek(0)

        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=notification_campaigns.xlsx"}
        )
    except Exception as e:
        logger.error(f"Admin export failed: {e}")
        return RedirectResponse(url="/admin?error=Export+failed", status_code=303)

@api_router.post("/cart/create-with-customer")
async def create_cart_with_customer(
    req: CreateCartReq,
    shopify_token: Optional[str] = Header(default=None, alias="x-shopify-customer-token"),
):
    lines = [{"merchandiseId": line.variantId, "quantity": line.quantity} for line in req.lines]
    cart_input = {"lines": lines}
    if req.attributes:
        cart_input["attributes"] = [{"key": attr.key, "value": attr.value} for attr in req.attributes]
    if shopify_token:
        cart_input["buyerIdentity"] = {"customerAccessToken": shopify_token}
        
    mutation = """
    mutation($input: CartInput!) {
      cartCreate(input: $input) {
        cart { id checkoutUrl cost { totalAmount { amount currencyCode } } }
        userErrors { field message }
      }
    }
    """
    data = await shopify_graphql(mutation, {"input": cart_input})
    cart_data = data.get("cartCreate", {})
    errors = cart_data.get("userErrors", [])
    if errors:
        raise HTTPException(status_code=400, detail=errors[0].get("message", "Cart creation failed"))
    cart = cart_data.get("cart", {})
    return {
        "cart_id": cart.get("id", ""),
        "checkout_url": cart.get("checkoutUrl", ""),
        "total": float(cart.get("cost", {}).get("totalAmount", {}).get("amount", 0)),
        "currency": cart.get("cost", {}).get("totalAmount", {}).get("currencyCode", "AED"),
    }


# ─── Hero Banner ───
@api_router.get("/hero-banner")
async def get_hero_banner():
    """
    Returns hero banner data from the Shopify 'frontpage' collection.
    Update the frontpage collection image/description in Shopify admin to change the banner.
    Falls back to shop metafields if the collection has no image.
    """
    query = """
    {
      collection(handle: "frontpage") {
        title
        description
        image { url altText }
        metafield(namespace: "hero", key: "subtitle") { value }
        metafield2: metafield(namespace: "hero", key: "cta_text") { value }
        metafield3: metafield(namespace: "hero", key: "cta_url") { value }
      }
    }
    """
    data = await shopify_graphql(query)
    collection = data.get("collection") or {}
    image_url = (collection.get("image") or {}).get("url", "")
    image_alt = (collection.get("image") or {}).get("altText", "")

    return {
        "image": image_url,
        "image_alt": image_alt,
        "title": collection.get("title", ""),
        "description": collection.get("description", ""),
        "subtitle": (collection.get("metafield") or {}).get("value", ""),
        "cta_text": (collection.get("metafield2") or {}).get("value", ""),
        "cta_url": (collection.get("metafield3") or {}).get("value", ""),
    }

@api_router.get("/hero-slides")
async def get_hero_slides():
    return await _get_hero_slides()

@api_router.get("/promo-banner")
async def get_promo_banner():
    return await _get_promo_banner()

@api_router.get("/events-banner")
async def get_events_banner():
    return await _get_events_banner()

@api_router.get("/custom-gift-banner")
async def get_custom_gift_banner():
    return await _get_custom_gift_banner()


# ─── Health ───
@api_router.get("/homepage-layout")
async def get_homepage_layout():
    template = await _get_active_theme_homepage_template()
    layout = _parse_homepage_layout_template(template)
    normalized = await _normalize_homepage_layout(layout)
    return await _resolve_homepage_layout_images(normalized)


@api_router.get("/admin-test")
async def admin_test():
    query = """
    {
      shop {
        name
        myshopifyDomain
        primaryDomain {
          url
          host
        }
      }
    }
    """
    data = await shopify_admin_graphql(query)
    return {
        "status": "ok",
        "shop": data.get("shop", {}),
        "admin_api_version": SHOPIFY_ADMIN_API_VERSION,
        "token_present": bool(SHOPIFY_ADMIN_TOKEN)
    }


@api_router.get("/health")
async def health():
    return {"status": "ok", "service": "Floarea API", "shopify_connected": bool(SHOPIFY_TOKEN)}

app.include_router(api_router)


# ─── Startup ───
@app.on_event("startup")
async def startup():
    if not _IS_PRODUCTION:
        try:
            # NON-DB operations (safe for dev only)
            os.makedirs("/app/memory", exist_ok=True)

            with open("/app/memory/test_credentials.md", "w") as f:
                f.write(
                    f"# Test Credentials\n\n"
                    f"## Shopify Customer Auth\n"
                    f"- POST /api/shopify-auth/register\n"
                    f"- POST /api/shopify-auth/login\n"
                    f"- GET /api/shopify-auth/orders (header: x-shopify-customer-token)\n\n"
                    f"## Push Notifications\n"
                    f"- POST /api/push/register\n"
                    f"- POST /api/push/send\n"
                    f"- DELETE /api/push/unregister\n"
                )
        except Exception as e:
            logger.error(f"Failed to write test credentials: {e}")
    else:
        logger.info("Skipping test credentials file write in production.")

    logger.info(f"Startup complete. ENV={_ENV}. Shopify store: {SHOPIFY_STORE}")
