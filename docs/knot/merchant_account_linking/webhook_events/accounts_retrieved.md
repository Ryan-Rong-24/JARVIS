# ACCOUNTS_RETRIEVED

## OpenAPI

````yaml api-reference/openapi.json webhook accounts-retrieved
paths:
  path: accounts-retrieved
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
                    example: ACCOUNTS_RETRIEVED
              session_id:
                allOf:
                  - type: string
                    description: Unique identifier for the session.
                    example: fb5aa994-ed1c-4c3e-b29a-b2a53222e584
              task_id:
                allOf:
                  - type: integer
                    description: Unique identifier for the task.
                    example: 25605
              external_user_id:
                allOf:
                  - type: string
                    description: Unique identifier for the user.
                    example: 3dcbb19a-b2f1-4a7b-8792-d76027b627b3
              merchant:
                allOf:
                  - type: object
                    properties:
                      id:
                        type: integer
                        description: Unique identifier for the merchant.
                        example: 26
                      name:
                        type: string
                        description: Name of the merchant.
                        example: Google Keychain
              timestamp:
                allOf:
                  - type: integer
                    description: Unix timestamp of the webhook event in UTC.
                    example: 1710864923198
            required: true
            refIdentifier: '#/components/schemas/AccountsRetrievedWebhook'
        examples:
          example:
            value:
              event: ACCOUNTS_RETRIEVED
              session_id: fb5aa994-ed1c-4c3e-b29a-b2a53222e584
              task_id: 25605
              external_user_id: 3dcbb19a-b2f1-4a7b-8792-d76027b627b3
              merchant:
                id: 26
                name: Google Keychain
              timestamp: 1710864923198
  response: {}
  deprecated: false
  type: webhook
components:
  schemas: {}

````