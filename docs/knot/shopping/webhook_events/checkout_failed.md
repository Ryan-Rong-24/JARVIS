# CHECKOUT_FAILED

## OpenAPI

````yaml api-reference/openapi.json webhook checkout-failed
paths:
  path: checkout-failed
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
                    example: CHECKOUT_FAILED
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
                        example: 7
                      name:
                        type: string
                        description: Name of the merchant.
                        example: Best Buy
                      logo:
                        type: string
                        description: Logo of the merchant.
                        example: >-
                          https://knot.imgix.net/merchants/KBQ5j6cN010PPpwbO7RpKGyDrCpsZ91FRhwnZp5u.png?auto=format&w=240
              data:
                allOf:
                  - type: object
                    properties:
                      reason:
                        type: string
                        description: Reason for the failure.
                        example: card declined
              timestamp:
                allOf:
                  - type: integer
                    description: Unix timestamp of the webhook event in UTC.
                    example: 1710864923198
            required: true
            refIdentifier: '#/components/schemas/CheckoutFailedWebhook'
        examples:
          example:
            value:
              event: CHECKOUT_FAILED
              external_user_id: 123abc
              merchant:
                id: 7
                name: Best Buy
                logo: >-
                  https://knot.imgix.net/merchants/KBQ5j6cN010PPpwbO7RpKGyDrCpsZ91FRhwnZp5u.png?auto=format&w=240
              data:
                reason: card declined
              timestamp: 1710864923198
  response: {}
  deprecated: false
  type: webhook
components:
  schemas: {}

````