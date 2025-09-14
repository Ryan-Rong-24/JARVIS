# Testing

The below steps and set of credentials allow you to test linking a merchant account, syncing a cart, checking out a cart, and retrieving post-purchase transaction data.

<Note>
  Please note that you cannot perform multiple operations on the same merchant account simultaneously, so you must wait to receive a webhook event to confirm the operation is complete before proceeding with any additional requests. \
  \
  For testing purposes, you can also use a different `external_user_id` when beginning a new round of testing to ensure you link a new merchant account.
</Note>

<Steps>
  <Step title="Create a session" titleSize="h3">
    Call [Create Session](/api-reference/sessions/create-session) with `type: link` and a dummy `external_user_id` that you will use in subsequent API requests.
  </Step>

  <Step title="Invoke the SDK" titleSize="h3">
    Use the session to invoke the SDK. In `KnotConfiguration`, pass the session in `sessionId` and a `merchantId` for a merchant of your choosing. In your implementation, merchants are retrieved via [List Merchants](/api-reference/merchants/list-merchants) by passing `type: shopping`. For testing purposes, you can likely hardcode a single `merchantId` for a merchant.
  </Step>

  <Step title="Login to a merchant account" titleSize="h3">
    Once you've invoked the SDK, you can link a merchant account by logging in to the merchant using the credentials `user_good`/ `pass_good`. Once your merchant account is successfully linked, you will receive the `AUTHENTICATED` webhook event.
  </Step>

  <Step title="Add a product to the cart" titleSize="h3">
    Upon receiving the `AUTHENTICATED` webhook event, make a request to [Sync Cart](/api-reference/products/shopping/sync-cart) with the same `external_user_id` & `merchant_id` as you used in prior steps and a dummy `products.external_id`. Optionally, pass a `delivery_location` as well in the request.

    Optionally, send `simulate: failed` in the request to simulate receiving a `SYNC_CART_FAILED` webhook event.
  </Step>

  <Step title="Receive SYNC_CART_SUCCEEDED webhook" titleSize="h3">
    Receive the `SYNC_CART_SUCCEEDED` webhook event.

    Optionally, make another request to [Sync Cart](/api-reference/products/shopping/sync-cart) with the `fullfillment.id` of an alternative fulfillment option received in the webhook.
  </Step>

  <Step title="Checkout" titleSize="h3">
    Upon receiving the `SYNC_CART_SUCCEEDED` webhook, make a request to [Checkout](/api-reference/products/shopping/checkout) with the same `external_user_id` & `merchant_id` as you used in prior steps and optionally a `payment_method` object.

    Optionally, send `simulate: failed` in the request to simulate receiving a `CHECKOUT_FAILED` webhook event.
  </Step>

  <Step title="Receive CHECKOUT_SUCCEEDED webhook" titleSize="h3">
    Receive the `CHECKOUT_SUCCEEDED` webhook event.
  </Step>

  <Step title="Retrieve the transaction information" titleSize="h3">
    Extract the `transactions.id` value(s) from the `CHECKOUT_SUCCEEDED` webhook event and make a request to [Get Transaction By ID](/api-reference/products/transaction-link/get-by-id) for each transaction to retrieve the transaction information.

    Most merchants generate a single transaction for a purchase, but some generate multiple.
  </Step>
</Steps>
