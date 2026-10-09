import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import AppChrome from "./AppChrome";

test("rewritten public pages render the same shell on the server and first browser render", () => {
  for (const [serverPath, browserPath] of [["/marketing", "/"], ["/integrations", "/integrations"], ["/privacy", "/privacy"]]) {
    const initialPublicPath = `/app${serverPath}`;
    const render = (pathname: string) => renderToString(
      <PathnameContext.Provider value={pathname}>
        <AppChrome initialPublicPath={initialPublicPath}><p>Public page fixture</p></AppChrome>
      </PathnameContext.Provider>
    );
    assert.equal(render(serverPath), "<p>Public page fixture</p>");
    assert.equal(render(browserPath), render(serverPath), "Apex rewrite must not insert workspace navigation during hydration");
  }
});
