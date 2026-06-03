import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RETRY_STORAGE_PREFIX = "lazy-retry:";
const IMPORT_ERROR_PATTERN = /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i;

type ModuleImport<T extends ComponentType<any>> = () => Promise<{ default: T }>;

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: ModuleImport<T>,
  importKey: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`${RETRY_STORAGE_PREFIX}${importKey}`);
      }

      return await importer();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const storageKey = `${RETRY_STORAGE_PREFIX}${importKey}`;

      if (typeof window !== "undefined" && IMPORT_ERROR_PATTERN.test(message)) {
        const hasRetried = sessionStorage.getItem(storageKey) === "true";

        if (!hasRetried) {
          sessionStorage.setItem(storageKey, "true");
          window.location.reload();

          return new Promise<never>(() => {
            // Intentionally pending while the page reloads.
          });
        }
      }

      throw error;
    }
  });
}