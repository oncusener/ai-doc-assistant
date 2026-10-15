# Acme Fleet Tracker — Customer FAQ

> Demo document. Acme Fleet Tracker is a fictional product.

## What does Acme Fleet Tracker do?

Acme Fleet Tracker is a GPS and telematics device for delivery vans and trucks. It reports location every 10 seconds while the vehicle is moving and every 15 minutes while it is parked. Fleet managers see live positions, trip history, fuel usage and driver behaviour alerts in the web dashboard and the mobile app.

## How long does the battery last?

The device is powered by the vehicle, but it has a backup battery that lasts up to 72 hours if the vehicle battery is disconnected. In backup mode it reports location every 30 minutes to save power.

## Which plans are available?

- **Basic** — €9 per vehicle per month: live tracking, 30 days of trip history, email alerts.
- **Pro** — €15 per vehicle per month: everything in Basic, 12 months of history, fuel reports, driver scoring and API access.
- **Enterprise** — custom pricing for fleets over 200 vehicles, with SSO, a dedicated account manager and a 99.9% uptime SLA.

Annual billing gives two months free on Basic and Pro.

## Can I integrate the data with my own systems?

Yes, on the Pro and Enterprise plans. The REST API returns vehicle positions, trips and alerts as JSON, and webhooks can push alerts to your systems in real time. The API is limited to 600 requests per minute per account.

## What happens if the device loses mobile coverage?

The device stores up to 10,000 position points offline and uploads them automatically when coverage returns, so trip history has no gaps.

## How do I cancel?

Monthly plans can be cancelled at any time from Settings → Billing and stop at the end of the current billing month. Annual plans are not refundable after the first 14 days. Devices are owned by the customer and keep working on a new plan if you resubscribe.

## How do I contact support?

Email support@acme-fleet.example or use the in-app chat. Support hours are Monday to Friday, 08:00–20:00 CET. Enterprise customers have a 24/7 phone line.
