## WhatsApp Production Handover

This project is prepared for Twilio WhatsApp notifications in two modes:

- Fallback mode: plain text `body` messages for local testing and sandbox work
- Production mode: approved WhatsApp templates through `ContentSid`

### What the code already does

- Sends low stock alerts to the current store admins by email and WhatsApp
- Sends near-expiry and expired stock alerts to the current store admins by email and WhatsApp
- Sends supplier reorder alerts to the preferred supplier by email and WhatsApp
- Includes the store name in the message content
- Supports per-store WhatsApp sender overrides through `TWILIO_WHATSAPP_SHOP_SENDER_MAP`

### Required environment variables

```env
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM_NUMBER=whatsapp:+14155238886
TWILIO_WHATSAPP_ADMIN_LOW_STOCK_TEMPLATE_SID=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_INVENTORY_ATTENTION_TEMPLATE_SID=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_SUPPLIER_REORDER_TEMPLATE_SID=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_SHOP_SENDER_MAP={"shop-id-1":"whatsapp:+14155238886","shop-id-2":"whatsapp:+14155239999"}
```

### Template variable contract

`TWILIO_WHATSAPP_ADMIN_LOW_STOCK_TEMPLATE_SID`

1. shop name
2. medicine name
3. available quantity
4. reorder level

`TWILIO_WHATSAPP_INVENTORY_ATTENTION_TEMPLATE_SID`

1. shop name
2. alert title
3. alert message
4. batch number or `-`
5. expiry date or `-`
6. quantity available or `-`

`TWILIO_WHATSAPP_SUPPLIER_REORDER_TEMPLATE_SID`

1. shop name
2. supplier name
3. medicine name
4. available quantity
5. reorder level
6. shortage gap

### Important display-name note

The name shown at the top of a WhatsApp chat is controlled by the approved WhatsApp sender in Twilio and Meta, not by message body text.

If each store must show a different visible WhatsApp business name, the company must provision and approve a separate WhatsApp sender for each store, then map each sender to its shop id through `TWILIO_WHATSAPP_SHOP_SENDER_MAP`.

### Company-side checklist

- Upgrade the Twilio account out of trial if production use is required
- Register the WhatsApp sender in Twilio
- Complete Meta Business verification
- Create and approve the three WhatsApp templates
- Provide the approved `HX...` template SIDs
- Provide the final sender numbers for each store if store-specific display names are required
- Replace the placeholder env values with the final credentials and template SIDs
