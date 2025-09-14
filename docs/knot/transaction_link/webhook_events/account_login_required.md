# ACCOUNT_LOGIN_REQUIRED

## OpenAPI

````yaml api-reference/openapi.json webhook account-login-required
paths:
  path: account-login-required
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
                    example: ACCOUNT_LOGIN_REQUIRED
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
                        example: 36
                      name:
                        type: string
                        description: Name of the merchant.
                        example: Uber Eats
                      logo:
                        type: string
                        description: Logo of the merchant.
                        example: >-
                          https://knot.imgix.net/merchants/KBQ5j6cN010PPpwbO7RpKGyDrCpsZ91FRhwnZp5u.png?auto=format&w=240
              timestamp:
                allOf:
                  - type: integer
                    description: Unix timestamp of the webhook event in UTC.
                    example: 1710864923198
            required: true
            refIdentifier: '#/components/schemas/AccountLoginRequiredWebhook'
        examples:
          example:
            value:
              event: ACCOUNT_LOGIN_REQUIRED
              external_user_id: 3dcbb19a-b2f1-4a7b-8792-d76027b627b3
              merchant:
                id: 36
                name: Uber Eats
                logo: >-
                  https://knot.imgix.net/merchants/KBQ5j6cN010PPpwbO7RpKGyDrCpsZ91FRhwnZp5u.png?auto=format&w=240
              timestamp: 1710864923198
  response: {}
  deprecated: false
  type: webhook
components:
  schemas: {}

````