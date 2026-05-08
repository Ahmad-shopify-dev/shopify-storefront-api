import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

const CONFIGURED_STOREFRONT_SCOPES = [
  "unauthenticated_read_checkouts",
  "unauthenticated_read_customers",
  "unauthenticated_write_customers",
  "unauthenticated_read_customer_tags",
  "unauthenticated_read_content",
  "unauthenticated_read_metaobjects",
  "unauthenticated_read_product_inventory",
  "unauthenticated_read_product_listings",
  "unauthenticated_read_product_pickup_locations",
  "unauthenticated_read_product_tags",
  "unauthenticated_read_selling_plans",
];

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
      query StorefrontDataLoader {
        shop {
          myshopifyDomain
        }
        currentAppInstallation {
          id
          accessScopes {
            handle
          }
          metafield(namespace: "$app", key: "storefront_data") {
            jsonValue
          }
        }
      }`,
  );
  const responseJson = await response.json();
  const appInstallation = responseJson?.data?.currentAppInstallation;
  const metafieldData = appInstallation?.metafield?.jsonValue ?? {};

  return {
    grantedScopes: (appInstallation?.accessScopes ?? []).map((scope) => scope.handle),
    storeDomain: responseJson?.data?.shop?.myshopifyDomain ?? "",
    storefrontData: {
      storefrontAccessToken: metafieldData?.storefrontAccessToken ?? "",
      selectedScopes: Array.isArray(metafieldData?.selectedScopes)
        ? metafieldData.selectedScopes
        : [],
      title: metafieldData?.title ?? "Storefront Token",
    },
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const title = formData.get("title")?.toString().trim() || `Storefront token ${Date.now()}`;
  const selectedScopes = formData
    .getAll("accessScopes")
    .map((scope) => scope.toString())
    .filter(Boolean);

  if (selectedScopes.length === 0) {
    return {
      ok: false,
      userErrors: [{ message: "Please select at least one access scope." }],
    };
  }

  const response = await admin.graphql(
    `#graphql
      mutation StorefrontAccessTokenCreate($input: StorefrontAccessTokenInput!) {
        storefrontAccessTokenCreate(input: $input) {
          userErrors {
            field
            message
          }
          shop {
            id
          }
          storefrontAccessToken {
            accessScopes {
              handle
            }
            accessToken
            title
          }
        }
      }`,
    {
      variables: {
        input: {
          title,
        },
      },
    },
  );
  const responseJson = await response.json();
  const payload = responseJson?.data?.storefrontAccessTokenCreate;
  const storefrontAccessToken = payload?.storefrontAccessToken?.accessToken ?? null;

  if (!storefrontAccessToken) {
    return {
      ok: false,
      userErrors: payload?.userErrors ?? [{ message: "Unable to create storefront token." }],
    };
  }

  const currentAppInstallationResponse = await admin.graphql(
    `#graphql
      query AppInstallationId {
        currentAppInstallation {
          id
        }
      }`,
  );
  const currentAppInstallationJson = await currentAppInstallationResponse.json();
  const appInstallationId = currentAppInstallationJson?.data?.currentAppInstallation?.id;

  if (!appInstallationId) {
    return {
      ok: false,
      userErrors: [{ message: "Could not resolve current app installation." }],
    };
  }

  const metafieldsSetResponse = await admin.graphql(
    `#graphql
      mutation SaveStorefrontData($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        metafields: [
          {
            ownerId: appInstallationId,
            namespace: "$app",
            key: "storefront_data",
            type: "json",
            value: JSON.stringify({
              storefrontAccessToken,
              selectedScopes,
              title,
            }),
          },
        ],
      },
    },
  );
  const metafieldsSetJson = await metafieldsSetResponse.json();
  const metafieldErrors = metafieldsSetJson?.data?.metafieldsSet?.userErrors ?? [];

  if (metafieldErrors.length > 0) {
    return {
      ok: false,
      userErrors: metafieldErrors,
    };
  }

  return {
    ok: true,
    storefrontAccessToken: {
      accessToken: storefrontAccessToken,
      title: payload?.storefrontAccessToken?.title ?? title,
    },
    selectedScopes,
    userErrors: payload?.userErrors ?? [],
  };
};

export default function Index() { 
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [tokenValue, setTokenValue] = useState(
    loaderData?.storefrontData?.storefrontAccessToken ?? "",
  );
  const [selectedScopes, setSelectedScopes] = useState(
    loaderData?.storefrontData?.selectedScopes?.length
      ? loaderData.storefrontData.selectedScopes
      : ["unauthenticated_read_product_listings"],
  );
  const [selectedProductHandle, setSelectedProductHandle] = useState("");
  const [selectedProductTitle, setSelectedProductTitle] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("product-card");
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";

  const availableScopes = useMemo(
    () => [
      "unauthenticated_read_checkouts",
      "unauthenticated_read_customers",
      "unauthenticated_write_customers",
      "unauthenticated_read_customer_tags",
      "unauthenticated_read_content",
      "unauthenticated_read_metaobjects",
      "unauthenticated_read_product_inventory",
      "unauthenticated_read_product_listings",
      "unauthenticated_read_product_pickup_locations",
      "unauthenticated_read_product_tags",
      "unauthenticated_read_selling_plans",
    ],
    [],
  );

  useEffect(() => {
    if (fetcher.data?.storefrontAccessToken?.accessToken) {
      setTokenValue(fetcher.data.storefrontAccessToken.accessToken);
      shopify.toast.show("Storefront access token created");
    }
  }, [fetcher.data, shopify]);

  const scopeComparison = useMemo(
    () =>
      selectedScopes.map((scope) => ({
        scope,
        isConfigured: CONFIGURED_STOREFRONT_SCOPES.includes(scope),
        isGranted: (loaderData?.grantedScopes ?? []).includes(scope),
      })),
    [selectedScopes, loaderData?.grantedScopes],
  );

  const toggleScope = (scope) => {
    setSelectedScopes((prevScopes) =>
      prevScopes.includes(scope)
        ? prevScopes.filter((item) => item !== scope)
        : [...prevScopes, scope],
    );
  };

  const copyToken = async () => {
    if (!tokenValue) return;
    try {
      await navigator.clipboard.writeText(tokenValue);
      shopify.toast.show("Token copied");
    } catch {
      shopify.toast.show("Unable to copy token");
    }
  };

  const openProductPicker = async () => {
    if (!shopify?.resourcePicker) {
      shopify.toast.show("Resource picker is not available in this app bridge version");
      return;
    }

    try {
      const pickerResult = await shopify.resourcePicker({
        type: "product",
        multiple: false,
      });

      const firstProduct = Array.isArray(pickerResult)
        ? pickerResult[0]
        : pickerResult?.selection?.[0] ?? pickerResult;

      const handle = firstProduct?.handle;
      if (!handle) {
        shopify.toast.show("No product selected");
        return;
      }

      setSelectedProductHandle(handle);
      setSelectedProductTitle(firstProduct?.title ?? handle);
      shopify.toast.show("Product selected");
    } catch {
      shopify.toast.show("Product selection cancelled");
    }
  };

  const generatedCode = useMemo(() => {
    if (!tokenValue || !selectedProductHandle || !loaderData?.storeDomain) {
      return "";
    }

    if (selectedTemplate === "product-card") {
      return `<script type="module" src="https://cdn.shopify.com/storefront/web-components.js"></script>
<shopify-store public-access-token="${tokenValue}" store-domain="https://${loaderData.storeDomain}" country="US" language="en"></shopify-store>

<div class="product-layout">
  <div class="product-card">
    <shopify-context type="product" handle="${selectedProductHandle}">
      <template>
        <div class="product-card__container">
          <div class="product-card__media">
            <shopify-media width="280" height="280" query="product.selectedOrFirstAvailableVariant.image"></shopify-media>
          </div>
          <div class="product-card__details">
            <h2 class="product-card__title">
              <shopify-data query="product.title"></shopify-data>
            </h2>
            <div class="product-card__price">
              <shopify-money query="product.selectedOrFirstAvailableVariant.price"></shopify-money>
            </div>
            <button onclick="document.querySelector('shopify-store').buyNow(event)">
              Buy now
            </button>
          </div>
        </div>
      </template>
    </shopify-context>
  </div>
</div>`;
    }

    return "";
  }, [loaderData?.storeDomain, selectedProductHandle, selectedTemplate, tokenValue]);

  const copyGeneratedCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      shopify.toast.show("Generated code copied");
    } catch {
      shopify.toast.show("Unable to copy generated code");
    }
  };

  return (
    <s-page heading="Storefront access token">
      <s-section heading="Create token with access scopes">
        <s-paragraph>
          Select the unauthenticated storefront access scopes, then create a token.
        </s-paragraph>
        <fetcher.Form method="post">
          <s-stack direction="block" gap="base">
            <label htmlFor="token-title">Token title</label>
            <input
              id="token-title"
              name="title"
              type="text"
              defaultValue={loaderData?.storefrontData?.title || "Storefront Token"}
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                border: "1px solid #d4d4d8",
              }}
            />

            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="tight">
                {availableScopes.map((scope) => (
                  <label key={scope} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      name="accessScopes"
                      value={scope}
                      checked={selectedScopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                    />
                    <span>{scope}</span>
                  </label>
                ))}
              </s-stack>
            </s-box>
            <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
              <s-text>Selected scopes comparison</s-text>
              <s-unordered-list>
                {scopeComparison.map((result) => (
                  <s-list-item key={result.scope}>
                    {result.scope} - {result.isConfigured ? "configured" : "not configured"} -{" "}
                    {result.isGranted ? "granted" : "not granted"}
                  </s-list-item>
                ))}
              </s-unordered-list>
            </s-box>

            <s-stack direction="inline" gap="base">
              <s-button type="submit" {...(isLoading ? { loading: true } : {})}>
                Get storefront access token
              </s-button>
              <s-button
                type="submit"
                name="renew"
                value="true"
                variant="secondary"
                {...(isLoading ? { loading: true } : {})}
              >
                Get new token
              </s-button>
            </s-stack>
          </s-stack>
        </fetcher.Form>
      </s-section>

      <s-section heading="Current token">
        {tokenValue ? (
          <s-stack direction="block" gap="base">
            <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
              <code style={{ wordBreak: "break-all" }}>{tokenValue}</code>
            </s-box>
            <s-stack direction="inline" gap="base">
              <s-button onClick={copyToken} variant="secondary">
                Copy token
              </s-button>
            </s-stack>
          </s-stack>
        ) : (
          <s-paragraph>No token generated yet.</s-paragraph>
        )}

        {fetcher.data?.userErrors?.length > 0 && (
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text tone="critical">Could not create token:</s-text>
            <s-unordered-list>
              {fetcher.data.userErrors.map((error, index) => (
                <s-list-item key={`${error.message}-${index}`}>{error.message}</s-list-item>
              ))}
            </s-unordered-list>
          </s-box>
        )}
      </s-section>

      <s-section heading="Storefront web components code generator">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            <s-button onClick={openProductPicker} variant="secondary">
              Pick product
            </s-button>
            <label htmlFor="template-selector">Template</label>
            <select
              id="template-selector"
              value={selectedTemplate}
              onChange={(event) => setSelectedTemplate(event.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #d4d4d8",
              }}
            >
              <option value="product-card">Product card</option>
            </select>
          </s-stack>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-paragraph>
              Store domain:{" "}
              <s-text>{loaderData?.storeDomain ? `https://${loaderData.storeDomain}` : "N/A"}</s-text>
            </s-paragraph>
            <s-paragraph>
              Selected product: <s-text>{selectedProductTitle || "None"}</s-text>
            </s-paragraph>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            {generatedCode ? (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                <code>{generatedCode}</code>
              </pre>
            ) : (
              <s-paragraph>
                Generate token + pick product to get copy-ready storefront web component code.
              </s-paragraph>
            )}
          </s-box>

          <s-stack direction="inline" gap="base">
            <s-button onClick={copyGeneratedCode} variant="secondary" disabled={!generatedCode}>
              Copy code
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
