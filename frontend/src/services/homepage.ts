import { api } from '../api';

// Shared in-flight/last-result promise so the homepage request can be kicked
// off as early as possible (before the Home screen even mounts) without ever
// firing more than one concurrent request for the same data.
let homepageLayoutPromise: Promise<any> | null = null;

export function prefetchHomepageLayout(): Promise<any> {
  if (!homepageLayoutPromise) {
    homepageLayoutPromise = api.get('/homepage-layout').catch((e) => {
      homepageLayoutPromise = null;
      throw e;
    });
  }
  return homepageLayoutPromise;
}
