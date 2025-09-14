# NEW_TRANSACTIONS_AVAILABLE

## OpenAPI

````yaml api-reference/openapi.json webhook new-transactions-available
paths:
  path: new-transactions-available
  method: post
  servers:
    - url: https://development.knotapi.com
      description: Development server
  request:
    security: []
    parameters:
      path: {}
      query: {}
      header: {}
      cookie: {}
    body:
      application/json:
        schemaArray:
          - type: object
            properties:
              event:
                allOf:
                  - type: string
                    description: Name of the webhook event.
                    example: NEW_TRANSACTIONS_AVAILABLE
              external_user_id:
                allOf:
                  - type: string
                    description: Unique identifier for the user.
                    example: 123abc
              merchant:
                allOf:
                  - type: object
                    properties:
                      id:
                        type: integer
                        description: Unique identifier for the merchant.
                        example: 36
                      name:
                        type: string
                        description: Name of the merchant.
                        example: Uber Eats
              timestamp:
                allOf:
                  - type: integer
                    description: Unix timestamp of the webhook event in UTC.
                    example: 1710864923198
            required: true
            refIdentifier: '#/components/schemas/NewTransactionsAvailableWebhook'
        examples:
          example:
            value:
              event: NEW_TRANSACTIONS_AVAILABLE
              external_user_id: 123abc
              merchant:
                id: 36
                name: Uber Eats
              timestamp: 1710864923198
  response: {}
  deprecated: false
  type: webhook
components:
  schemas: {}

````