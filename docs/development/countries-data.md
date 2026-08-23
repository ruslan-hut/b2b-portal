# Countries Data Preload Scripts

This directory contains SQL scripts to preload the `countries` table with comprehensive country data including ISO 3166-1 alpha-2 codes, country names, and VAT rates.

## Files

- `preload_countries.sql` - MySQL version
- `preload_countries_postgres.sql` - PostgreSQL version

## Data Sources

### Country Codes and Names
- **ISO 3166-1 alpha-2 codes**: Standard two-letter country codes maintained by the International Organization for Standardization (ISO)
- Country names are in English and follow common naming conventions

### VAT Rates
VAT rates are based on standard rates as of 2024-2025:

- **European Union**: Standard VAT rates for all 27 EU member states
- **Other European countries**: Standard VAT rates (Switzerland, Norway, UK, etc.)
- **Other countries**: Common VAT/GST rates where applicable
- **0% rate**: Used for countries where:
  - No VAT/GST system exists
  - VAT/GST varies significantly by region/state (e.g., US, Canada, India, Brazil)
  - VAT is not applicable

**Note**: VAT rates are subject to change. It's recommended to periodically review and update the rates, especially for countries you do business with.

## Usage

### MySQL

```bash
# Direct connection
mysql -u comex -p comex < migrations/preload_countries.sql

# Docker container
docker exec comex-db mysql -u comex_user -pcomex_password comex_db < migrations/preload_countries.sql
```

### PostgreSQL

```bash
# Direct connection
psql -U comex -d comex -f migrations/preload_countries_postgres.sql

# Docker container
docker exec -i comex-db psql -U comex_user -d comex_db < migrations/preload_countries_postgres.sql
```

## Data Coverage

The scripts include:
- **195+ countries** with ISO 3166-1 alpha-2 codes
- Standard VAT rates for EU countries (19-27%)
- VAT/GST rates for major trading countries
- Proper handling of countries with variable or no VAT systems

## Updating Data

To update existing countries:
- Both scripts use `ON DUPLICATE KEY UPDATE` (MySQL) or `ON CONFLICT ... DO UPDATE` (PostgreSQL)
- Existing records will be updated with new names and VAT rates
- The `last_update` timestamp will be automatically updated

## Verification

After running the script, verify the data:

```sql
-- Count total countries
SELECT COUNT(*) as total_countries FROM countries;

-- View sample data
SELECT country_code, name, vat_rate FROM countries ORDER BY name LIMIT 20;

-- Check EU countries
SELECT country_code, name, vat_rate FROM countries 
WHERE country_code IN ('AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE')
ORDER BY vat_rate DESC;
```

## Important Notes

1. **VAT Rate Format**: The database stores VAT rates as integers (0-100), representing percentages. Decimal rates have been rounded to the nearest integer.

2. **Regional Variations**: Some countries (US, Canada, India, Brazil) have variable tax rates by state/province. These are set to 0% in the database. You may need to handle regional variations in your application logic.

3. **Rate Updates**: VAT rates change periodically. Consider:
   - Setting up a periodic review process
   - Using an external API for real-time VAT rates (if needed)
   - Maintaining a changelog of rate updates

4. **Data Accuracy**: While efforts have been made to ensure accuracy, always verify VAT rates for your specific use case, especially for:
   - Countries where you conduct significant business
   - Countries with recent tax law changes
   - Countries with multiple VAT rates (standard, reduced, etc.)

## References

- [ISO 3166-1 alpha-2 codes](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)
- [EU VAT Rates](https://ec.europa.eu/taxation_customs/business/vat/eu-vat-rules-topic/vat-rates_en)
- [Tax Foundation - VAT Rates](https://taxfoundation.org/data/all/eu/value-added-tax-vat-rates-europe/)

