# Quickstart

## Introduction

TransactionLink enables you to retrieve SKU-level transaction data from a user's merchant on a recurring basis. With TransactionLink, you can retrieve both historical transactions and new transactions that will occur in the future. You can reference the exact data you'll receive for each transaction [here](https://knot-minor-updates.mintlify.app/api-reference/products/transaction-link/transaction-object).

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
  <Accordion title="Access your customer dashboad" icon="table-columns">
    Ensure you have access to your [Customer Dashboard](https://dashboard.knotapi.com) and retrieve your `client_id` and `secret`, which you will use as the basic auth username and password for your API key respectively. Note that your `client_id` and `secret` vary between  the`development` and `production` environments.
  </Accordion>

  <Accordion title="Subscribe to webhooks" icon="webhook">
    Subscribe to webhooks in your [Customer Dashboard](https://dashboard.knotapi.com) so your backend can be notified about user-generated events, as well as asynchronous processes. You will need to receive these events later on in the flow.
  </Accordion>

  <Accordion title="Retrieve available merchants" icon="list-ul">
    Call [List Merchants](/api-reference/merchants/list-merchants) to retrieve a list of merchants that are available for the TransactionLink product by passing `type = transaction_link`. These are merchants you can display in your app and allow users to link. To get started quickly, you can use `merchant_id: 19` for DoorDash to later pass when initializing the SDK

    You will be notified via the [`MERCHANT_STATUS_UPDATE`](/link/webhook-events/merchant-status-update) webhook when/if this list changes.
  </Accordion>

  <Accordion title="Create a session" icon="code">
    With your `client_id` and `secret` for the `development` environment, call [Create Session](/api-reference/sessions/create-session) to create a session used when invoking the SDK.
  </Accordion>

  <Accordion title="Install the SDK" icon="file-import">
    Install an SDK of your choosing, for example on iOS [here](/sdk/ios). If you are using the Web SDK, make sure to allowlist your application's domains for the `development` and `production` environments in your [Customer Dashboard](https://dashboard.knotapi.com).
  </Accordion>

  <Accordion title="Initialize the SDK" icon="play">
    Initialize the SDK with the `session_id` retrieved from [Create Session](/api-reference/sessions/create-session) and a merchant `Id` retrieved from [List Merchants](/api-reference/merchants/list-merchants) in `KnotConfiguration` or you can use `merchant_id: 19` for DoorDash to get started quickly. The SDK is where users will interact with the Knot UI to authenticate to various merchants. All login flows, including step-up authentication, are handled within the SDK. Users will see real-time feedback as they progress through authenticating with a merchant.

    <Note>
      Specifying an exact merchant by passing a merchant `Id` in `KnotConfiguration` when initializing the SDK is required for the TransactionLink product.
    </Note>
  </Accordion>
</AccordionGroup>

### Link a merchant account

<AccordionGroup>
  <Accordion title="Login" icon="arrow-right-to-bracket">
    **In the development environment,** use [testing credentials](/transaction-link/testing) to login to a merchant account and simulate retrieving transactions.
  </Accordion>

  <Accordion title="Handle authenticated event" icon="arrow-right">
    Ingest the [`AUTHENTICATED`](/link/webhook-events/authenticated) webhook to notify your backend that the merchant account is successfully linked to Knot and that the connection status is `connected`. Similarly and as applicable, listen to the client-side `onEvent` callback in the SDK to receive the `authenticated` event.

    You can also use [Get Merchant Accounts](https://knot-accounts-get.mintlify.app/api-reference/accounts/get-accounts) to retrieve this and other merchant accounts, as well as their connection status. This can be useful to know that you should display the merchant account to the user in their list of linked merchant accounts with the appropriate connection status (i.e. `connected` or `disconnected`). See more about handling disconnected merchant accounts [here](/transaction-link/quickstart#handle-disconnected-merchant-accounts).
  </Accordion>
</AccordionGroup>

## Receive transactions

### New transactions

To be notified about new transactions in a merchant account, listen to the [`NEW_TRANSACTIONS_AVAILABLE`](/transaction-link/webhook-events/new-transactions-available) webhook. You will receive this event shortly after a user authenticates to a merchant account for the first time and on any subsequent instance where new transactions are created in the merchant account.

Upon receiving the [`NEW_TRANSACTIONS_AVAILABLE`](/transaction-link/webhook-events/new-transactions-available) webhook, make a request (or multiple) to [Sync Transactions](/api-reference/products/transaction-link/sync) to sync new transactions for a user's specific merchant account. **In the development environment**, you will receive 205 new transactions.

### Updated transactions

<Note>
  Receiving updated transaction information is entirely optional and may not be relevant for your use case.
</Note>

To be notified about updates to existing transactions, listen to the [`UPDATED_TRANSACTIONS_AVAILABLE`](/transaction-link/webhook-events/updated-transactions-available) webhook. You will receive this event for a merchant account each time there are existing transactions for which data has changed (e.g. `orderStatus: SHIPPED` -> `orderStatus: DELIVERED`).

Upon receiving the [`UPDATED_TRANSACTIONS_AVAILABLE`](/transaction-link/webhook-events/updated-transactions-available) webhook with an array of transaction IDs, make a request to [Get Transaction By Id](/api-reference/products/transaction-link/get-by-id) for each transaction ID, passing the ID received in the webhook as a path parameter.

## Handle disconnected merchant accounts

If for example a user changes their password to a merchant account, the `connection.status` in [Get Merchant Accounts](/api-reference/accounts/get-accounts) will be returned as `disconnected` and you will not receive transaction data for the user's merchant account until it is reconnected. If this occurs, you will be notified via the [`ACCOUNT_LOGIN_REQUIRED`](/link/webhook-events/account-login-required) webhook event. You'll want to display a UX in your app to allow users to reconnect their account. For example, you may choose to display a button that says "Reconnect" or similar.

<Note>
  To test this behavior in development, use the [Disconnect Account](/api-reference/development/disconnect-account) endpoint.
</Note>

## Unlink merchant accounts

To unlink a user's specific merchant account if they request it, make a request to [Unlink Merchant Account](/api-reference/accounts/unlink-account).
