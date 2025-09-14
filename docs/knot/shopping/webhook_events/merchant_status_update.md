# MERCHANT_STATUS_UPDATE

## OpenAPI

````yaml api-reference/openapi.json webhook merchant-status-update
paths:
  path: merchant-status-update
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
                    example: MERCHANT_STATUS_UPDATE
              merchant:
                allOf:
                  - type: object
                    properties:
                      id:
                        type: integer
                        description: Unique identifier for the merchant.
                        example: 10
                      name:
                        type: string
                        description: Name of the merchant.
                        example: Uber
                      category:
                        type: string
                        description: Category of the merchant.
                        example: Transportation
                      logo:
                        type: string
                        description: Logo of the merchant.
                        example: >-
                          https://knot.imgix.net/merchants/KBQ5j6cN010PPpwbO7RpKGyDrCpsZ91FRhwnZp5u.png?auto=format&w=240
              data:
                allOf:
                  - type: object
                    properties:
                      type:
                        type: string
                        description: Product type.
                        enum:
                          - card_switcher
                          - transaction_link
                          - shopping
                        example: card_switcher
                      status:
                        type: string
                        description: Merchant availability status.
                        enum:
                          - UP
                          - DOWN
                        example: UP
                      platform:
                        type: string
                        description: Platform the status applies to.
                        enum:
                          - ios
                          - android
                          - web
                        example: ios
                      sdk:
                        type:
                          - string
                          - 'null'
                        description: Minimum SDK version the status applies to.
                        example: 1.0.0
              timestamp:
                allOf:
                  - type: integer
                    description: Unix timestamp of the webhook event in UTC.
                    example: 1710864923198
            required: true
            refIdentifier: '#/components/schemas/MerchantStatusUpdateWebhook'
        examples:
          example:
            value:
              event: MERCHANT_STATUS_UPDATE
              merchant:
                id: 10
                name: Uber
                category: Transportation
                logo: >-
                  https://knot.imgix.net/merchants/KBQ5j6cN010PPpwbO7RpKGyDrCpsZ91FRhwnZp5u.png?auto=format&w=240
              data:
                type: card_switcher
                status: UP
                platform: ios
                sdk: 1.0.0
              timestamp: 1710864923198
  response: {}
  deprecated: false
  type: webhook
components:
  schemas: {}

````