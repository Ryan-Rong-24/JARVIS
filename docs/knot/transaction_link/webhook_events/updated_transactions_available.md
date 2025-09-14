# UPDATED_TRANSACTIONS_AVAILABLE

## OpenAPI

````yaml api-reference/openapi.json webhook updated-transactions-available
paths:
  path: updated-transactions-available
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
                    example: UPDATED_TRANSACTIONS_AVAILABLE
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
              updated:
                allOf:
                  - type: array
                    description: Array of transaction UUIDs.
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                          description: UUID for the transaction.
                          example: 13da3c28-a068-4642-9ce2-b730cfda5f5f
              timestamp:
                allOf:
                  - type: integer
                    description: Unix timestamp of the webhook event in UTC.
                    example: 1710864923198
            required: true
            refIdentifier: '#/components/schemas/UpdatedTransactionsAvailableWebhook'
        examples:
          example:
            value:
              event: UPDATED_TRANSACTIONS_AVAILABLE
              external_user_id: 123abc
              merchant:
                id: 36
                name: Uber Eats
              updated:
                - id: 13da3c28-a068-4642-9ce2-b730cfda5f5f
              timestamp: 1710864923198
  response: {}
  deprecated: false
  type: webhook
components:
  schemas: {}

````