# Storefront API Manager

The easiest way to build and manage your Shopify Storefront API integration. This app helps you generate storefront access tokens and provides tools to quickly build storefront experiences using Shopify Web Components.

## Features
- **Storefront Access Token Management**: Create and manage storefront access tokens with specific scopes directly from your Shopify admin.
- **Web Component Code Generator**: Generate ready-to-use HTML/JavaScript code for Storefront Web Components (e.g., Product Cards).
- **Access Scopes Configuration**: Easily select and verify required unauthenticated access scopes.

## Tech Stack
- **Framework**: [React Router v7](https://reactrouter.com/) (Next generation of Remix)
- **Language**: JavaScript / TypeScript
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Database & ORM**: [Prisma](https://www.prisma.io/)
- **Shopify Integration**: [Shopify App Bridge](https://shopify.dev/docs/apps/checkout/app-bridge) & [@shopify/shopify-app-react-router](https://www.npmjs.com/package/@shopify/shopify-app-react-router)
- **Styling**: Shopify Polaris & Custom Web Components

## Workflow
1. **Authentication**: The app uses Shopify's authenticated admin context to ensure secure access to your store's backend.
2. **Token Creation**: Users select required `unauthenticated` scopes and generate a Storefront Access Token using the Admin GraphQL API.
3. **Data Storage**: Generated tokens and selected scopes are stored in **App Metafields**, making them persistent and accessible across sessions.
4. **Code Generation**: By combining the persistent token with a product selected via the **Resource Picker**, the app generates ready-to-use HTML snippets for Shopify's Storefront Web Components.
5. **Implementation**: Developers can either use the generated code snippets in their frontend or leverage the `unauthenticated` client provided in `shopify.server.js` for custom server-side logic.

---

## The Easiest Way to Build Storefront API

### 1. GET TO THIS LINK
[https://webcomponents.shopify.dev/playground](https://webcomponents.shopify.dev/playground)

- Find your resource like product card or whatever else.
- Add your shop domain and your product handle or anything else if you want to access the protected features like metafields.

### 2. GO TO THIS LINK AND INSTALL SHOPIFY HEADLESS
[https://apps.shopify.com/headless](https://apps.shopify.com/headless)

- Create your storefront and get `public_access_token` from here.
- Find `<shopify-store>` in the first link code and add `public-access-token="your_public_token"`.
- Copy the code and paste in any website even in your localhost.

---

## SECOND WAY TO GET THE STOREFRONT ACCESS TOKEN

1. Create a custom app with redirect paths in your admin dashboard.
2. Get `client_id` and `client_secret` and send to:
   `your_store_domain/admin/oauth/authorize?client_id&client_secret&redirect_uri`
3. From here you get a code. Then pass this code to:
   `your_store_domain/admin/oauth/access_token?client_id&client_secret&code`
4. From this endpoint you will get an access token for the store.

Now hit a GraphQL API to get the token of the store:
`https://your_store_domain.myshopify.com/admin/api/2025-01/graphql.json`

And then hit the GraphQL API mutation:
```graphql
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
}
```
Hit this endpoint with `X-Shopify-Access-Token`. You will get the `accessToken` for `store_front_api`.

---

## DOCS
- [Storefront Web Components](https://shopify.dev/docs/api/storefront-web-components)
- [Web Components Playground](https://webcomponents.shopify.dev/playground?view=editor)
- [Storefront API Latest](https://shopify.dev/docs/api/storefront/latest)
- [GraphiQL Storefront API Exploration](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/api-exploration/graphiql-storefront-api)

---

## FOR NODE ADD YOU CAN USE THIS PACKAGE
[https://www.npmjs.com/package/@shopify/storefront-api-client](https://www.npmjs.com/package/@shopify/storefront-api-client)

---

## FOR REACT ROUTER APP WHAT YOU CAN DO

1. Update your TOML file with `access_scopes`.
2. Use the `unauthenticated` module to implement storefront logic:

```javascript
import { unauthenticated } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const { storefront } = await unauthenticated.storefront('quickstart-52b79549.myshopify.com');

  const repsonse = await storefront.graphql(`#graphql
    query Products @inContext(country: GB) {
      woolSweater: product(handle: "wool-sweater") {
        title
      }
      alarmClock: product(handle: "alarm-clock") {
        title
      }
      products(first: 2) {
        nodes {
          title
        }
      }
    }`);

    const jsonProduct = await repsonse.json();
  return {
    products: jsonProduct.data
  };
};
```

The `unauthenticated` module will help you implement storefront logic.

---

## Supported Storefront Access Scopes
As seen in `app._index.jsx`, the following scopes are commonly used:
- `unauthenticated_read_checkouts`
- `unauthenticated_read_customers`
- `unauthenticated_write_customers`
- `unauthenticated_read_customer_tags`
- `unauthenticated_read_content`
- `unauthenticated_read_metaobjects`
- `unauthenticated_read_product_inventory`
- `unauthenticated_read_product_listings`
- `unauthenticated_read_product_pickup_locations`
- `unauthenticated_read_product_tags`
- `unauthenticated_read_selling_plans`

---

## Author
**Stackwise Dev**

## License
This project is open-source and provided **free for learning purposes**. You are encouraged to use it as a reference for building your own Shopify storefront integrations.
