---
name: API bundle external dependencies
description: Runtime dependency resolution for packages externalized by the API server bundler.
---

The API server's esbuild configuration externalizes all `@swc/*` packages. If a bundled runtime dependency imports an SWC helper, such as PDFKit's fontkit dependency importing `@swc/helpers`, declare that helper directly in the API server package so the emitted bundle can resolve it at runtime.

**Why:** The typecheck and esbuild build can pass while Node fails to start because the import is left external and is not resolvable through the package's dependency tree from the bundled output.

**How to apply:** After adding a server dependency, inspect emitted imports for externalized modules, verify runtime resolution by starting the managed API workflow, and add any required runtime helpers as direct dependencies.

Keep PDFKit external rather than bundling its internals.

**Why:** Its standard fonts use package-local `#standard-fonts` imports. Bundling moves their resolution outside PDFKit's package scope; startup succeeds but the first PDF request fails when constructing a document.

**How to apply:** Test PDF creation from the emitted server's runtime location, including standard-font text, not only a direct import from the source package. A successful build and health endpoint do not verify lazy-loaded font assets.
