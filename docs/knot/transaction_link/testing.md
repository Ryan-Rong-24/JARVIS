# Testing

The below steps and sets of credentials allow you to test logging in to merchant accounts and simulate generating transactions.

<Steps>
  <Step title="Create a session" titleSize="h3">
    Call [Create Session](/api-reference/sessions/create-session) with `type: transaction_link` and a dummy `external_user_id`.

    <Note>
      Please note that if you intend to test generating transactions multiple times consecutively in a short period, it is recommended to use a different dummy `external_user_id` for each session.
    </Note>
  </Step>

  <Step title="Invoke the SDK" titleSize="h3">
    Use the `session_id` you receive when creating a session to invoke the SDK. In `KnotConfiguration`, pass a `merchantId` for a merchant of your choosing. In your implementation, merchants are retrieved via [List Merchants](/api-reference/merchants/list-merchants). For testing purposes, you can likely hardcode a single `id` for a merchant.
  </Step>

  <Step title="Login to a merchant account" titleSize="h3">
    Once you've invoked the SDK, you can login to a merchant account using one of the sets of credentials below, depending on what you would like to test.

    | Scenario                         | What will happen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Username                 | Password            |
    | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------- |
    | New transactions                 | Your user's merchant account will be successfully linked. 205 new transactions will be generated within a few seconds and you will be notified of them via the `NEW_TRANSACTIONS_AVAILABLE` event. The transactions will be retrievable via [Sync Transactions](/api-reference/products/transaction-link/sync).                                                                                                                                                                                                                                                                               | `user_good_transactions` | `pass_good`         |
    | New **and updated** transactions | Your user's merchant account will be successfully linked. 205 new transactions will be generated within a few seconds and you will be notified of them via the `NEW_TRANSACTIONS_AVAILABLE` event. The transactions will be retrievable via [Sync Transactions](/api-reference/products/transaction-link/sync). Additionally, 3 transactions will be updated and you will be notified of them via the `UPDATED_TRANSACTIONS_AVAILABLE` event nearly immediately as well. The transactions wil be retrievable via [Get Transaction By ID](/api-reference/products/transaction-link/get-by-id). | `user_good_transactions` | `pass_good_updates` |
  </Step>
</Steps>
