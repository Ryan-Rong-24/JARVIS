# Web

## Overview

<Note>
  Version 1.0+ of the Web SDK introduces breaking changes that require changes in your application code if you had previously integrated an early version. See the [Migration Guide](/sdk/migration-guides/web/web-1-0) for further details.
</Note>

<Tip>
  **SDK Updates**\
  New versions of the SDK are released frequently, not only to add new features and address issues in the SDK, but also to continuously improve the conversion of merchant login flows. As a result, it is strongly recommended that you frequently update your SDK version across any platforms where you invoke the SDK.
</Tip>

The Knot Link SDK provides a seamless way for end users to link their merchant accounts to your web app, serving as the foundation for Knot's merchant connectivity platform. It is a client-side integration, consisting of initializing & configuring the SDK and handling events.

## Installation

The Knot JS SDK is hosted on [unpkg.com](http://unpkg.com), a popular CDN for everything on npm. You can also host the SDK on your servers if preferred.

The `next` tag is applied in version `1.0.0`+, which is not automatically fetched by npm when running `npm install knotapi-js`.

### Via npm

For Node.js environments, use npm to install the KnotapiJS SDK like below:

```bash
npm install knotapi-js@next --save
```

### Via CDN

For browser-based projects, you can use the KnotapiJS SDK via a CDN:

```html
<script src="https://unpkg.com/knotapi-js@next"></script>
```

## Initialization

Your backend will create a session by calling [Create Session](/api-reference/sessions/create-session) and provide it to your frontend. To start a Knot session, you must first configure the SDK. The configuration allows you to set the environment, product type, entry point, and other user experience configurations.

<Note>
  It's expected that your integration with Knot will retrieve and pass a new session into the SDK on each initialization.
</Note>

### Configure the SDK

The SDK is configured using the following parameters when using the `open` method:

| Name          | Type        | Description                                                                                                                                                                                                             |
| ------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sessionId     | String      | The session created by calling `/session/create` in your backend.                                                                                                                                                       |
| clientId      | String      | Your organization's client ID. Note that this varies between `development` and `production` environments.                                                                                                               |
| environment   | Environment | The desired environment (`development` or `production`).                                                                                                                                                                |
| product       | Product     | The Knot product the session will inherit - the same as the type of session created. E.g. `card_switcher` or `transaction_link`.                                                                                        |
| merchantIds   | \[int]?     | **Optional when product = card\_switcher. Required when product = transaction\_link.** A list of merchant ID(s) to display. It is recommended to provide 0 or 1 merchant IDs depending on your desired user experience. |
| entryPoint    | String?     | **Optional.** The specific entry point from within your app where you are initializing the Knot SDK (e.g. `onboarding`).                                                                                                |
| useCategories | Boolean     | **Optional.** Whether to display merchant categories and therefore group merchants into categories for discoverability. Default: `true`.                                                                                |
| useSearch     | Boolean     | **Optional.** Whether to display the search bar, enabling users to search for merchants. Default: `true`.                                                                                                               |

<Warning>
  The below parameters are entirely optional and infrequently used, typically only when you offer Knot for multiple, differently-named card programs in the same app. The Knot team will set pre-defined values for each parameter that you can then subsequently pass into the SDK. Passing a value that is not pre-defined will result in an `onError` callback. To take advantage of this functionality, please contact the Knot team who will be happy to assist you.
</Warning>

| Name         | Type   | Description                                                                                                                                                                                                                                                                         |
| :----------- | :----- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cardName     | String | **Optional.** The differentiated display name for the card product, used inside the Knot SDK (e.g. `Debit Card`, `Credit Card`). This value will override the default value `Card`.                                                                                                 |
| customerName | String | **Optional.** The differentiated display name for the company, used both as a standalone and prepended to the `cardName` (e.g. `Smart Bank`, `Payment Corp`). This value will override your default customer name value. Only recommended if you issue cards under multiple brands. |
| logoId       | String | **Optional.** The differentiated logo for the company. This value will override your default logo.                                                                                                                                                                                  |

See the following real example for how the `cardName` and `customerName` parameters are used together in text inside the Knot SDK: `"Your [customerName] [cardName | Card] was added."`

### Open the SDK

Invoke the `open` method with the parameters like below:

#### Node.js

```javascript
import KnotapiJS from "knotapi-js";
const knotapi = new KnotapiJS();

// Invoke the open method with parameters
knotapi.open({
sessionId: "Your Session ID",
clientId: "Your Client ID",
environment: "development", // or "production"
product: "card_switcher", // or "transaction_link"
merchantIds: [17], // Recommend 0 or 1 merchant IDs
entryPoint: "onboarding", // Defined by you
useCategories: true, // Recommend true
useSearch: true, // Recommend true
customerName: "Company name", // Optional customer configuration
cardName: "Card Name", // Optional customer configuraiton
logoId: 1234 // Optional customer configuration
});
```

#### Browser

```javascript
const KnotapiJS = window.KnotapiJS.default;
const knotapi = new KnotapiJS();

// Invoke the open method with parameters
knotapi.open({
sessionId: "Your Session ID",
clientId: "Your Client ID",
environment: "development",  // or "production"
product: "card_switcher",  // or "transaction_link"
merchantIds: [17],, // Recommend 0 or 1 merchant IDs
entryPoint: "onboarding", // Defined by you
useCategories: true, // Recommend true
useSearch: true, // Recommend true
customerName: "Company name", // Optional customer configuration
cardName: "Card Name", // Optional customer configuraiton
logoId: 1234 // Optional customer configuration
});
```

<Note>
  To test logging in to a merchant in the SDK, please reference a set of available test credentials for the CardSwitcher product [here](/card-switcher/testing) and Transaction Link product [here](/transaction-link/testing).
</Note>

## Single Merchant Flow

If you decide to use [List Merchants](/api-reference/merchants/list-merchants) to retrieve a list of merchants, list them in your app, and then open the SDK with a single merchant, you can do so by passing a merchant ID when [configuring the session](/sdk/web#configure-the-session) in the `KnotConfiguration`. More in [Retrieving & Listing Merchants](/link/retrieving-and-listing-merchants). The merchant ID is the same across all environments.

<Info>
  Although available, it is not recommended that you provide a long list of merchants in order to remove a few, but rather “hide” certain merchants that you desire from your [Customer Dashboard](https://dashboard.knotapi.com/).
</Info>

## Entry Points

In your app’s user experience, you may choose to integrate Knot in one or multiple places (e.g. from different tabs or screens). How users behave when interacting with Knot from each of these “entry points” may vary and it will be useful for you to be able to differentiate these groups of users by entry point in order to assess the value of each entry point.

You can provide a value for the entry point when initializing the SDK in `knotapi.open`. This value will be returned in the `AUTHENTICATED` webhook.

## Categories & Search

Users are presented with a list of merchants in the SDK (unless you provide a single merchant as described above). Accompanying the list is a set of categories and a search experience. Each of these components is visible to users by default (as set in Knot's backend).

You can choose to remove either of them by setting `useCategories: false` and `useSearch: false` when initializing the SDK. **This is not recommended.**

## Events

The `open` method provides several callbacks you can use to receive events from the SDK.

```javascript
knotapi.open({
  sessionId: "Your Session ID",
  clientId: "Your Client ID",
  environment: "development",  // or "production"
  product: "card_switcher", // or "transaction_link"
  merchantIds: [17],
  entryPoint: "onboarding",
  onSuccess: (product, details) => { console.log("onSuccess", product, details); },
  onError: (product, errorCode, message) => { console.log("onError", product, errorCode, message); },
  onEvent: (product, event, merchant, payload, taskId) => { console.log("onEvent", product, event, merchant, payload, taskId); },
  onExit: (product) => { console.log("onExit", product)} 
});
```

### `onSuccess`

This event is called when a user successfully logged in to the merchant and their card was switched. It takes the following arguments: `product` and `details`, the latter of which contains the `merchantName` field, representing the merchant for which the card was updated.

### `onError`

This event is called when an error occurs during SDK initialization. It takes the following arguments: `errorCode` and `errorDescription`.

| errorCode               | errorDescription              | Debugging Steps                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| INVALID\_SESSION        | The session ID is invalid.    | Ensure `KnotConfiguration.environment` matches the environment the `sessionId` was created for (`development` or `production`).                                                                                                                                                                                                                                    |
| EXPIRED\_SESSION        | The session has expired.      | Sessions are valid for 30 minutes. It is best practice to ensure that you create a new session **every time** a user invokes the SDK using [Create Session](/api-reference/sessions/create-session).                                                                                                                                                               |
| INVALID\_CLIENT\_ID     | The client ID is invalid.     | Verify that the value you are providing for `KnotConfiguration.clientId` is for the environment matching the value you are providing for `KnotConfiguration.environment` (i.e. `development` or `production`). If you provide your production `clientId` but set `environment: development`, you will experience this error.                                       |
| INTERNAL\_ERROR         | An internal error occurred.   | Simply retry invoking the SDK with a new `sessionId`.                                                                                                                                                                                                                                                                                                              |
| INVALID\_MERCHANT\_ID   | The merchant ID is required.  | The `type` of `sessionId` you are providing on invokation of the SDK requires that you also provide a value in `KnotConfiguration.merchantIds` to ensure the user is directed to a specific merchant’s login flow in the SDK. You can retrieve a list of merchant IDs (the same in all environments) in [List Merchants](/api-reference/merchants/list-merchants). |
| INVALID\_CARD\_NAME     | The card name is invalid.     | The value you are providing for `customerConfiguration.cardName` must exactly match an allowlisted value for your organization. Please reach out to the Knot team for access to this allowlist.                                                                                                                                                                    |
| INVALID\_CUSTOMER\_NAME | The customer name is invalid. | The value you are providing for `customerConfiguration.customerName` must exactly match an allowlisted value for your organization. Please reach out to the Knot team for access to this allowlist.                                                                                                                                                                |
| INVALID\_LOGO\_ID       | The logo ID is invalid.       | The value you are providing for `customerConfiguration.logoId` must exactly match an allowlisted value for your organization. Please reach out to the Knot team for access to this allowlist.                                                                                                                                                                      |

```javascript
  onError: (product, errorCode, errorDescription) => {
    console.log("onError", product, errorCode, errorDescription);
}
```

### `onExit`

This event is called when a user closes the SDK.

### `onEvent`

This event is called when certain events occur in the SDK. With this callback, you will be able to understand how a user is progressing through their lifecycle of authenticating to a merchant. It takes the following arguments: `product`, `event`, `merchant`, `merchantId`, `payload`, and `taskId`.

```javascript
  onEvent: (product, event, merchant, merchantId, payload, taskId) => {
    console.log("onEvent", product, event, merchant, merchantId, payload, taskId);
}
```

The following list contains all possible events emitted in the `event` property:

| Event                     | Description                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| REFRESH\_SESSION\_REQUEST | Emitted when the session used to initialize the SDK needs to be refreshed.                                                                          |
| MERCHANT\_CLICKED         | Emitted when a user clicks on a merchant from the merchant list.                                                                                    |
| LOGIN\_STARTED            | Emitted when a user submits their credentials to login to the merchant.                                                                             |
| AUTHENTICATED             | Emitted when a user successfully logs in to the merchant.                                                                                           |
| OTP\_REQUIRED             | Emitted when a user needs to enter an OTP code to login to the merchant.                                                                            |
| QUESTIONS\_REQUIRED       | Emitted when a user needs to enter answers to security questions to login to the merchant.                                                          |
| APPROVAL\_REQUIRED        | Emitted when a user needs to approve the login - often via a push notification or directly in the merchant's mobile app - to login to the merchant. |
| ZIPCODE\_REQUIRED         | Emitted when a user needs to enter their zip code to login to the merchant.                                                                         |
| LICENSE\_REQUIRED         | Emitted when a user needs to enter their drivers license to login to the merchant.                                                                  |
