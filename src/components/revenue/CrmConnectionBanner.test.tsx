import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import CrmConnectionBanner from "./CrmConnectionBanner";

test("CrmConnectionBanner renders prompt to connect HubSpot with link to hubspot integration", () => {
  const html = renderToString(<CrmConnectionBanner pageName="deals" />);
  assert.ok(
    html.includes("Hey, the reason there<!-- -->&#x27;<!-- -->s nothing here is because you need to connect your HubSpot") ||
    html.includes("Hey, the reason there's nothing here is because you need to connect your HubSpot") ||
    html.includes("connect your HubSpot"),
    "Must include the clear message that HubSpot is not connected"
  );
  assert.ok(html.includes("/admin/integrations/hubspot"), "Must link directly to HubSpot integration setup");
  assert.ok(html.includes("Connect your HubSpot"), "Must have the big button to connect HubSpot");
  assert.ok(html.includes("/admin/integrations"), "Must link to all CRM integrations as alternative");
});

test("CrmConnectionBanner renders forecast-specific context when on forecast page", () => {
  const html = renderToString(<CrmConnectionBanner pageName="forecast" />);
  assert.ok(html.includes("revenue projections"), "Should mention revenue forecast details");
  assert.ok(html.includes("/admin/integrations/hubspot"), "Must link to HubSpot integration");
});
