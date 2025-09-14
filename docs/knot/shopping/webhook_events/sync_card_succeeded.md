# SYNC_CART_SUCCEEDED

## OpenAPI

````yaml api-reference/openapi.json webhook sync-cart-succeeded
paths:
  path: sync-cart-succeeded
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
                    example: SYNC_CART_SUCCEEDED
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
                        example: 4
                      name:
                        type: string
                        description: Name of the merchant.
                        example: Walmart
                      logo:
                        type: string
                        description: Logo of the merchant.
                        example: >-
                          https://knot.imgix.net/merchants/KBQ5j6cN010PPpwbO7RpKGyDrCpsZ91FRhwnZp5u.png?auto=format&w=240
              data:
                allOf:
                  - type: object
                    properties:
                      cart:
                        type: object
                        properties:
                          products:
                            type: array
                            items:
                              type: object
                              properties:
                                external_id:
                                  type: string
                                  description: External identifier for the product.
                                  example: 123abc
                                fulfillment:
                                  allOf:
                                    - $ref: '#/components/schemas/Fulfillment'
                                    - type: object
                                      properties:
                                        options:
                                          type: array
                                          items:
                                            $ref: '#/components/schemas/Fulfillment'
                                          description: >-
                                            Alternative fulfillment options to the
                                            currently selected fulfillment
                                            preference.
                            description: List of products in the cart.
                          delivery_location:
                            type:
                              - object
                              - 'null'
                            description: Delivery location for the cart.
                            properties:
                              address:
                                type: object
                                description: ''
                                properties:
                                  line1:
                                    type: string
                                    description: First line of the delivery address.
                                    example: 123 Main St
                                  line2:
                                    type:
                                      - string
                                      - 'null'
                                    description: Second line of the delivery address.
                                    example: Floor 4
                                  city:
                                    type: string
                                    description: City portion of the delivery address.
                                    example: Los Angeles
                                  region:
                                    type: string
                                    description: >-
                                      Region portion of the delivery address,
                                      usually a state abbreviation. Must be an
                                      ISO 3166-2 sub-division code.
                                    example: CA
                                  postal_code:
                                    type: string
                                    description: Postal code of the delivery address.
                                    example: '94105'
                                  country:
                                    type: string
                                    description: >-
                                      Country portion of the delivery address.
                                      Must be an ISO 3166-1 alpha-2 code.
                                    example: US
                              first_name:
                                type:
                                  - string
                                  - 'null'
                                maxLength: 255
                                description: First name for the delivery address.
                                example: Ada
                              last_name:
                                type:
                                  - string
                                  - 'null'
                                maxLength: 255
                                description: Last name for the delivery address.
                                example: Lovelace
                              phone_number:
                                type:
                                  - string
                                  - 'null'
                                description: >-
                                  Phone number for the delivery address in E.164
                                  format.
                                example: '+11234567890'
                          price:
                            $ref: '#/components/schemas/CartPrice'
              timestamp:
                allOf:
                  - type: string
                    description: Unix timestamp of the webhook event in UTC.
                    example: '1710864923198'
            required: true
            refIdentifier: '#/components/schemas/SyncCartSucceededWebhook'
        examples:
          example:
            value:
              event: SYNC_CART_SUCCEEDED
              external_user_id: 123abc
              merchant:
                id: 4
                name: Walmart
                logo: >-
                  https://knot.imgix.net/merchants/KBQ5j6cN010PPpwbO7RpKGyDrCpsZ91FRhwnZp5u.png?auto=format&w=240
              data:
                cart:
                  products:
                    - external_id: 123abc
                      fulfillment:
                        id: >-
                          5cfbe095d0cb9e597e316170d6ee9a6c667bddcde4a999222d2cc2b5bbfef7cf
                        type: SCHEDULED_DELIVERY
                        label: Express delivery
                        availabilityStart: 2025-08-10T15:00:00Z-05:00
                        availabilityEnd: 2025-08-10T15:00:00Z-08:00
                        price:
                          total: <any>
                          currency: <any>
                        options:
                          - id: >-
                              5cfbe095d0cb9e597e316170d6ee9a6c667bddcde4a999222d2cc2b5bbfef7cf
                            type: SCHEDULED_DELIVERY
                            label: Express delivery
                            availabilityStart: 2025-08-10T15:00:00Z-05:00
                            availabilityEnd: 2025-08-10T15:00:00Z-08:00
                            price:
                              total: <any>
                              currency: <any>
                  delivery_location:
                    address:
                      line1: 123 Main St
                      line2: Floor 4
                      city: Los Angeles
                      region: CA
                      postal_code: '94105'
                      country: US
                    first_name: Ada
                    last_name: Lovelace
                    phone_number: '+11234567890'
                  price:
                    sub_total: '12.56'
                    adjustments:
                      - type: TAX
                        label: NYC local sales tax
                        amount: '3.67'
                    total: '16.23'
                    currency: USD
              timestamp: '1710864923198'
  response: {}
  deprecated: false
  type: webhook
components:
  schemas:
    CartPrice:
      type: object
      properties:
        sub_total:
          type: string
          description: Subtotal price of the products in the cart.
          example: '12.56'
        adjustments:
          type: array
          items:
            $ref: '#/components/schemas/Adjustment'
          description: List of price adjustments.
        total:
          type: string
          description: Total price of the products in the cart.
          example: '16.23'
        currency:
          type: string
          description: Currency of the price. ISO 4217 format.
          example: USD
    Adjustment:
      type: object
      properties:
        type:
          type: string
          enum:
            - DISCOUNT
            - TAX
            - TIP
            - FEE
            - REFUND
            - UNRECOGNIZED
          description: Type of adjustment.
          example: TAX
        label:
          type:
            - string
            - 'null'
          description: Label of the adjustment from the merchant.
          example: NYC local sales tax
        amount:
          type: string
          description: Amount of the adjustment.
          example: '3.67'
    Fulfillment:
      type: object
      description: >-
        Fulfillment information containing the currently selected fulfillment
        preference in the root and additional fulfillment options in
        `fulfillment.options`.
      properties:
        id:
          type: string
          description: Unique identifier for the fulfillment preference.
          example: 5cfbe095d0cb9e597e316170d6ee9a6c667bddcde4a999222d2cc2b5bbfef7cf
        type:
          type: string
          description: Type of fulfillment preference
          oneOf:
            - enum:
                - UNSCHEDULED_DELIVERY
              title: Unscheduled Delivery
              description: >-
                Delivered from a fulfillment center to the user’s address
                without a scheduled delivery window.
            - enum:
                - SCHEDULED_DELIVERY
              title: Scheduled Delivery
              description: >-
                Delivered from a store or local fulfillment center to the user’s
                address in a scheduled delivery window.
          example: SCHEDULED_DELIVERY
        label:
          type: string
          description: Label of the fulfillment preference from the merchant.
          example: Express delivery
        availabilityStart:
          type:
            - string
            - 'null'
          description: >-
            Timestamp of the fulfillment preference in UTC. ISO 8601 format. If
            unscheduled, this value represents the date of the fulfillment. If
            scheduled, this value represents the beginning of the scheduled
            window.
          example: 2025-08-10T15:00:00Z-05:00
        availabilityEnd:
          type:
            - string
            - 'null'
          description: >-
            Timestamp of the end of the scheduled fulfillment preference window
            in UTC. ISO 8601 format. If unscheduled, this value will be the same
            as the availabilityStart. If scheduled, this value represents the
            end of the scheduled window.
          example: 2025-08-10T15:00:00Z-08:00
        price:
          type: object
          description: Price information for the fulfillment preference.
          properties:
            total:
              type: string
              description: >-
                Total price of the fulfillment preference. This is included in
                `price.total` for the entire cart, despite not being listed in
                `price.adjustments`.
              example: '0.00'
            currency:
              type: string
              description: Currency of the price. ISO 4217 format.
              example: USD

````