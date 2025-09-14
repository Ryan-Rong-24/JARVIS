# Retrieving and Listing Merchants

## Overview

In your app, you may choose to list **available** merchants for users to view, select from, and ultimately link. Knot allows you to retrieve a list of available merchants via API based on a number of parameters, so that you can completely control and customize the UX & UI for how you display merchants to your users.

This optional functionality serves as an alternative to the merchant list and search experience within the Knot SDK. In addition, choosing to list merchants directly in your own app's UI goes hand-in-hand with providing a specific merchant (that the user selected) when you invoke the SDK.

## Retrieving, Listing, and Searching

You can retrieve merchants from the [List Merchants](/api-reference/merchants/list-merchants) endpoint. In doing so, there are a number of body parameters that will modify list of merchants returned in the response.

<AccordionGroup>
  <Accordion title="type" defaultOpen="true">
    The value you provide in this parameter ensures that the merchant list you receive includes available merchants for a specific product. This is important as not all product use cases are supported for every merchant on Knot's platform.
  </Accordion>

  <Accordion title="platform" defaultOpen="true">
    Knot supports merchants across `iOS`, `android`, and `web`, however, not every merchant is supported on each. This parameter can be used to retrieve a list of available merchants on a given platform, so that only those available merchants may be displayed to users on each platform.

    When you provide a value for this parameter in the request, the response will additionally include the `min_sdk_version` field representing the minimum SDK version (on the platform provided in the request) for which the merchant is available.

    <Warning>
      If you invoke the SDK with a `merchantId` for a merchant that is not available on the SDK version your app is running, the user will be presented with an error screen, so be sure to only display merchants that have a `min_sdk_version` below the version your app is running.
    </Warning>
  </Accordion>

  <Accordion title="search" defaultOpen="true">
    If you choose to offer your users a search experience in your app where they can search for different merchants by keyword, you can provide a user's search keyword to this parameter and retrieve a merchant (or list of merchants) that match that keyword.

    For example, if you provide a user's search keyword as `hub` to this parameter, you may receive a list of merchants including `Grubhub`, `Stubhub`, and `Github`.
  </Accordion>
</AccordionGroup>
