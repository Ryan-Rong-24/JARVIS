# Create Session

> Create a session and use it to initialize the SDK.

## OpenAPI

````yaml POST /session/create
paths:
  path: /session/create
  method: post
  servers:
    - url: https://development.knotapi.com
      description: Development server
  request:
    security:
      - title: basicAuth
        parameters:
          query: {}
          header:
            Authorization:
              type: http
              scheme: basic
              description: "Basic authentication header of the form `Basic <encoded-value>`, where `<encoded-value>` is the base64-encoded string `username:password`. Use your\_`client_id`\_as the `username` and your\_`secret`\_as the `password` value."
          cookie: {}
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
              type:
                allOf:
                  - type: string
                    enum:
                      - card_switcher
                      - transaction_link
                      - link
                    description: Product to associate the session with.
                    example: card_switcher
              external_user_id:
                allOf:
                  - type: string
                    description: Your unique identifier for the user.
                    example: 123abc
              card_id:
                allOf:
                  - type: string
                    description: >-
                      Your unique identifier for a specific card. **Required if
                      type = card_switcher.**
                    example: 81n9al10a0ayn13
              phone_number:
                allOf:
                  - type: string
                    description: User's phone number in E.164 format.
                    example: '+11234567890'
              email:
                allOf:
                  - type: string
                    description: User's email address.
                    example: ada.lovelace@gmail.com
              card:
                allOf:
                  - type: object
                    description: ''
                    properties:
                      blocked:
                        type: boolean
                        description: Whether the user's card is blocked.
                        example: false
                        default: false
                      has_funds:
                        type: boolean
                        description: Whether the user's card has funds.
                        example: true
                        default: true
              processor_token:
                allOf:
                  - type: string
                    description: >-
                      Plaid processor_token if using transaction data from Plaid
                      to detect merchants.
                    example: processor-production-0asd1-a92nc
            requiredProperties:
              - type
              - external_user_id
        examples:
          example:
            value:
              type: card_switcher
              external_user_id: 123abc
              card_id: 81n9al10a0ayn13
              phone_number: '+11234567890'
              email: ada.lovelace@gmail.com
              card:
                blocked: false
                has_funds: true
              processor_token: processor-production-0asd1-a92nc
        description: The input parameters required for creating a session.
  response:
    '200':
      application/json:
        schemaArray:
          - type: object
            properties:
              session:
                allOf:
                  - type: string
                    description: A session.
                    example: 915efe72-5136-4652-z91q-d9d48003c102
        examples:
          example:
            value:
              session: 915efe72-5136-4652-z91q-d9d48003c102
        description: Successful request.
    '400':
      application/json:
        schemaArray:
          - type: object
            properties:
              error_type:
                allOf:
                  - &ref_0
                    type: string
                    description: Type of error.
                    enum:
                      - INVALID_INPUT
                      - INVALID_REQUEST
                      - USER_ERROR
                      - SESSION_ERROR
                      - MERCHANT_ACCOUNT_ERROR
                      - MERCHANT_ERROR
                      - TRANSACTION_ERROR
                      - CART_ERROR
                    example: INVALID_REQUEST
              error_code:
                allOf:
                  - &ref_1
                    type: string
                    description: Error code.
                    enum:
                      - INVALID_API_KEYS
                      - INVALID_FIELD
                      - INVALID_JWE
                      - INVALID_CURSOR_FORMAT
                      - USER_NOT_FOUND
                      - MERCHANT_ACCOUNT_NOT_FOUND
                      - SESSION_NOT_FOUND
                      - EXTEND_NOT_SUPPORTED
                      - PRODUCT_NOT_ENABLED
                      - MERCHANT_ACCOUNT_NOT_FOUND
                      - MERCHANT_ACCOUNT_DISCONNECTED
                      - MERCHANT_UNAVAILABLE
                      - NO_ACCESS
                      - TRANSACTION_NOT_FOUND
                      - CART_NOT_FOUND
                      - FULFILLMENT_NOT_FOUND
                    example: INVALID_FIELD
              error_message:
                allOf:
                  - &ref_2
                    type: string
                    description: Detailed error message.
                    example: The limit may not be greater than 10.
            refIdentifier: '#/components/schemas/Error'
        examples:
          InvalidProductType:
            summary: Invalid product type
            value:
              error_type: INVALID_INPUT
              error_code: PRODUCT_NOT_VALID
              error_message: The selected type is invalid.
          CardIdRequired:
            summary: 'card_id is missing for type: card_switcher'
            value:
              error_type: INVALID_REQUEST
              error_code: INVALID_FIELD
              error_message: The card_id field is required when type = card_switcher.
          ExternalUserIdRequired:
            summary: external_user_id is missing
            value:
              error_type: INVALID_REQUEST
              error_code: INVALID_FIELD
              error_message: The external user id field is required.
          TypeRequired:
            summary: type is missing
            value:
              error_type: INVALID_REQUEST
              error_code: INVALID_FIELD
              error_message: The type field is required.
          InvalidPhoneNumber:
            summary: Phone number is invalid
            value:
              error_type: INVALID_REQUEST
              error_code: INVALID_FIELD
              error_message: The phone number format is invalid.
          InvalidEmail:
            summary: Email is invalid
            value:
              error_type: INVALID_REQUEST
              error_code: INVALID_FIELD
              error_message: The email must be a valid email address.
          InvalidProcessorToken:
            summary: Processor token is invalid
            value:
              error_type: INVALID_REQUEST
              error_code: INVALID_FIELD
              error_message: The processor token must be a string.
          InvalidCardBlocked:
            summary: card.blocked is invalid
            value:
              error_type: INVALID_REQUEST
              error_code: INVALID_FIELD
              error_message: The card.blocked field must be true or false.
        description: Bad request.
    '401':
      application/json:
        schemaArray:
          - type: object
            properties:
              error_type:
                allOf:
                  - *ref_0
              error_code:
                allOf:
                  - *ref_1
              error_message:
                allOf:
                  - *ref_2
            refIdentifier: '#/components/schemas/Error'
        examples:
          AuthFailed:
            summary: Auth failed
            value:
              error_type: INVALID_INPUT
              error_code: INVALID_API_KEYS
              error_message: Invalid client_id or secret provided.
        description: Unauthorized request.
    '403':
      application/json:
        schemaArray:
          - type: object
            properties:
              error_type:
                allOf:
                  - *ref_0
              error_code:
                allOf:
                  - *ref_1
              error_message:
                allOf:
                  - *ref_2
            refIdentifier: '#/components/schemas/Error'
        examples:
          NoAccess:
            summary: No access
            value:
              error_type: INVALID_REQUEST
              error_code: NO_ACCESS
              error_message: >-
                The type of session is not enabled. Please contact Knot for
                access to this type of session.
        description: Forbidden request.
    '500':
      application/json:
        schemaArray:
          - type: object
            properties:
              error_type:
                allOf:
                  - *ref_0
              error_code:
                allOf:
                  - *ref_1
              error_message:
                allOf:
                  - *ref_2
            refIdentifier: '#/components/schemas/Error'
        examples:
          InternalServerError:
            summary: Unexpected server error
            value:
              message: Server Error
        description: Internal server error.
  deprecated: false
  type: path
components:
  schemas: {}

````

Call this:

```bash
curl --request POST \
  --url https://development.knotapi.com/session/create \
  --header 'Authorization: Basic ZGRhMDc3OGQtOTQ4Ni00N2Y4LWJkODAtNmYyNTEyZjliY2RiOjg4NGQ4NGU4NTUwNTRjMzJhOGUzOWQwOGZjZDk4NDVk' \
  --header 'Content-Type: application/json' \
  --data '{
  "card": {
    "has_funds": true,
    "blocked": false
  },
  "type": "transaction_link",
  "external_user_id": "ryan"
}'
```

clientId=dda0778d-9486-47f8-bd80-6f2512f9bcdb