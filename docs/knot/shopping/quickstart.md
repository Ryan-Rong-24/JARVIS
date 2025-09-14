# Quickstart

## Introduction

Knot's Shopping product enables you to embed native merchant cart creation and checkout capabilities into your app. With Shopping, users can seamlessly add products to their merchant carts and complete purchases without leaving your application.

## Entry Points

#### Overview

How and where you place entry points to invoke the Knot flow in your app play a crucial role driving engagement and delivering value to end users. Nearly all apps that integrate Knot develop multiple entry points into the Knot flow (e.g. different tabs or screens).

As a result and **to provide better visibility into the conversion of the flow across different entry points**, the Knot SDK supports an `entryPoint` parameter when invoking the SDK which allows you to specify the entry point from which the user came. This value is then returned in the down-funnel [`AUTHENTICATED`](/link/webhook-events/authenticated) webhook event, thereby allowing you to measure the conversion of the flow by entry point in your analytics tool of choice.

#### Usage

It is strongly recommended to take advantage of this functionality, so as to future-proof your visibility into your implementation and allow for future optimizations. To take advantage of this functionality, simply pass a different value to `KnotConfiguration.entryPoint` for each of your entry points when [configuring the session to invoke the SDK](/sdk/ios#configure-the-session).

Common entry points include the following: `onboarding`, `home`, `push-notif-X`, `in-app-lifecycle-card-X`, etc.

## Getting started

### Start the flow

<AccordionGroup>
  <Accordion title="Access your customer dashboad" defaultOpen="true" icon="table-columns">
    Ensure you have access to your [Customer Dashboard](https://dashboard.knotapi.com) and retrieve your `client_id` and `secret`, which you will use as the basic auth username and password for your API key respectively. Note that your `client_id` and `secret` vary between  the`development` and `production` environments.
  </Accordion>

  <Accordion title="Subscribe to webhooks" defaultOpen="true" icon="webhook">
    Subscribe to webhooks in your [Customer Dashboard](https://dashboard.knotapi.com) so your backend can be notified about user-generated events, as well as asynchronous processes. You will need to receive these events later on in the flow.
  </Accordion>

  <Accordion title="Retrieve available merchants" defaultOpen="true" icon="list-ul">
    Call [List Merchants](/api-reference/merchants/list-merchants) to retrieve a list of merchants that are available for the Shopping product by passing `type = shopping`. These are merchants you can display in your app, allow users to link, and subsequently shop at. To get started quickly, you can use `merchant_id: 45` for Walmart to later pass when initializing the SDK.

    You will be notified via the [`MERCHANT_STATUS_UPDATE`](/link/webhook-events/merchant-status-update) webhook when/if this list changes.
  </Accordion>

  <Accordion title="Create a session" defaultOpen="true" icon="code">
    With your `client_id` and `secret` for the `development` environment, call [Create Session](/api-reference/sessions/create-session) with `type: link` to create a session used when invoking the SDK.
  </Accordion>

  <Accordion title="Install the SDK" defaultOpen="true" icon="file-import">
    Install an SDK of your choosing, for example on iOS [here](/sdk/ios). If you are using the Web SDK, make sure to allowlist your application's domains for the `development` and `production` environments in your [Customer Dashboard](https://dashboard.knotapi.com).
  </Accordion>

  <Accordion title="Initialize the SDK" defaultOpen="true" icon="play">
    Initialize the SDK with the `session_id` retrieved from [Create Session](/api-reference/sessions/create-session). In `KnotConfiguration`, pass a merchant `Id` retrieved from [List Merchants](/api-reference/merchants/list-merchants) or you can use `merchant_id: 45` for Walmart to get started quickly. The SDK is where users will interact with the Knot UI to link various merchant accounts. All login flows, including step-up authentication, are handled within the SDK. Users will see real-time feedback as they link a merchant account.

    <Note>
      Specifying an exact merchant by passing a merchant `Id` in `KnotConfiguration` is required when initializing the SDK with a session with `type: link`.
    </Note>
  </Accordion>
</AccordionGroup>

### Link a merchant account

<AccordionGroup>
  <Accordion title="Login" defaultOpen="true" icon="arrow-right-to-bracket">
    **In the development environment,** login to a merchant account using `user_good` / `pass_good` credentials to link your user's merchant account.
  </Accordion>

  <Accordion title="Handle authenticated event" defaultOpen="true" icon="arrow-right">
    Ingest the [`AUTHENTICATED`](/link/webhook-events/authenticated) webhook to notify your backend that the merchant account is successfully linked to Knot and that the connection status is `connected`. Similarly and as applicable, listen to the client-side `onEvent` callback in the SDK to receive the `authenticated` event.

    You can also use [Get Merchant Accounts](/api-reference/accounts/get-accounts) to retrieve this and other merchant accounts, as well as their connection status. This can be useful to know that you should display the merchant account to the user in their list of linked merchant accounts with the appropriate connection status (i.e. `connected` or `disconnected`). See more about handling disconnected merchant accounts [here](/shopping/quickstart#handle-disconnected-merchant-accounts).
  </Accordion>
</AccordionGroup>

## Add a product to a cart

Call [Sync Cart](/api-reference/products/shopping/sync-cart) to add a product to a cart using the `product.external_id`. To be notified when a product is successfully added to a cart and to receive cart information, listen to the [`SYNC_CART_SUCCEEDED`](/shopping/webhook-events/sync-cart-succeeded) webhook.

#### Update delivery address (optional)

If a user would like to update their delivery address after initially provided in [Sync Cart](/api-reference/products/shopping/sync-cart), simply make the same request again with a new `delivery_location`, like you are patching the cart. You will receive fresh information regarding the cart, including the `price.total`.

<Note>
  A delivery address must be present in the user's merchant account prior to checkout if the fulfillment is via any delivery option. Therefore, if a `delivery_location` is not provided in [Sync Cart](/api-reference/products/shopping/sync-cart) and/or a `delivery_location` is not provided back in `SYNC_CART_SUCCEEDED`, then you cannot proceed with [Checkout](/api-reference/products/shopping/checkout).
</Note>

#### Update fulfillment preference (optional)

If a user would like to update the fulfillment preference for a given product after the initial [Sync Cart](/api-reference/products/shopping/sync-cart) request, simply make the same request again with a value for `products.fulfillment.id` that you received in the `SYNC_CART_SUCCEEDED` webhook. You will receive fresh information regarding the cart, including the `price.total`.

## Checkout

Call [Checkout](/api-reference/products/shopping/checkout) to checkout a cart. To be notified when a checkout process is successful, listen to the [`CHECKOUT_SUCCEEDED`](/shopping/webhook-events/checkout-succeeded) webhook, which will include an array of transactions by `Id` created by the checkout.

## Get order confirmation details

When you receive the [`CHECKOUT_SUCCEEDED`](/shopping/webhook-events/checkout-succeeded) webhook, call [Get Transaction By Id](/api-reference/products/transaction-link/get-by-id) for each transaction you receive (using the `transaction.id`) to retrieve transaction information and subsequently enrich an order confirmation.

## Handle disconnected merchant accounts

If for example a user changes their password to a merchant account, the `connection.status` in [Get Merchant Accounts](/api-reference/accounts/get-accounts) will be returned as `disconnected` and you will not be able to make any successful requests to [Sync Cart](/api-reference/products/shopping/sync-cart) or [Checkout](/api-reference/products/shopping/checkout) until the user's merchant account is reconnected. If this occurs, you'll be notified via the [`ACCOUNT_LOGIN_REQUIRED`](/link/webhook-events/account-login-required) webhook event. You'll want to display a UX in your app to allow users to reconnect their account. For example, you may choose to display a button that says "Reconnect" or similarly allow the user to invoke the SDK to reconnect their account.

<Note>
  To test this behavior in development, use the [Disconnect Account](/api-reference/development/disconnect-account) endpoint.
</Note>

## Unlink merchant accounts

To unlink a user's specific merchant account if they request it, make a request to [Unlink Merchant Account](/api-reference/accounts/unlink-account).
