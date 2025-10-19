/**
 * Available Countries Configuration
 * Complete list of countries with metadata for news aggregation
 */

export const availableCountries = [
  // English-speaking countries (en)
  { code: 'US', name: 'United States', language: 'en', languageName: 'English', continent: 'North America', icon: 'icons/flags/united states.svg' },
  { code: 'GB', name: 'United Kingdom', language: 'en', languageName: 'English', continent: 'Europe', icon: 'icons/flags/united kingdom.svg' },
  { code: 'AU', name: 'Australia', language: 'en', languageName: 'English', continent: 'Oceania', icon: 'icons/flags/australia.svg' },
  { code: 'CA', name: 'Canada', language: 'en', languageName: 'English', continent: 'North America', icon: 'icons/flags/canada.svg' },
  { code: 'NZ', name: 'New Zealand', language: 'en', languageName: 'English', continent: 'Oceania', icon: 'icons/flags/new zealand.svg' },
  { code: 'IE', name: 'Ireland', language: 'en', languageName: 'English', continent: 'Europe', icon: 'icons/flags/ireland.svg' },
  { code: 'ZA', name: 'South Africa', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/south africa.svg' },
  { code: 'SG', name: 'Singapore', language: 'en', languageName: 'English', continent: 'Asia', icon: 'icons/flags/singapore.svg' },
  { code: 'IN', name: 'India', language: 'en', languageName: 'English', continent: 'Asia', icon: 'icons/flags/india.svg' },
  { code: 'JM', name: 'Jamaica', language: 'en', languageName: 'English', continent: 'North America', icon: 'icons/flags/jamaica.svg' },
  { code: 'BB', name: 'Barbados', language: 'en', languageName: 'English', continent: 'North America', icon: 'icons/flags/barbados.svg' },
  { code: 'BS', name: 'Bahamas', language: 'en', languageName: 'English', continent: 'North America', icon: 'icons/flags/bahamas.svg' },
  { code: 'BZ', name: 'Belize', language: 'en', languageName: 'English', continent: 'North America', icon: 'icons/flags/belize.svg' },
  { code: 'BW', name: 'Botswana', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/botswana.svg' },
  { code: 'FJ', name: 'Fiji', language: 'en', languageName: 'English', continent: 'Oceania', icon: 'icons/flags/fiji.svg' },
  { code: 'GM', name: 'Gambia', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/gambia.svg' },
  { code: 'GH', name: 'Ghana', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/ghana.svg' },
  { code: 'GD', name: 'Grenada', language: 'en', languageName: 'English', continent: 'North America', icon: 'icons/flags/grenada.svg' },
  { code: 'GY', name: 'Guyana', language: 'en', languageName: 'English', continent: 'South America', icon: 'icons/flags/guyana.svg' },
  { code: 'KE', name: 'Kenya', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/kenya.svg' },
  { code: 'LS', name: 'Lesotho', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/lesotho.svg' },
  { code: 'LR', name: 'Liberia', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/liberia.svg' },
  { code: 'MW', name: 'Malawi', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/malawi.svg' },
  { code: 'MT', name: 'Malta', language: 'en', languageName: 'English', continent: 'Europe', icon: 'icons/flags/malta.svg' },
  { code: 'MU', name: 'Mauritius', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/mauritius.svg' },
  { code: 'NA', name: 'Namibia', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/namibia.svg' },
  { code: 'NG', name: 'Nigeria', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/nigeria.svg' },
  { code: 'PK', name: 'Pakistan', language: 'en', languageName: 'English', continent: 'Asia', icon: 'icons/flags/pakistan.svg' },
  { code: 'PG', name: 'Papua New Guinea', language: 'en', languageName: 'English', continent: 'Oceania', icon: 'icons/flags/papua new guinea.svg' },
  { code: 'PH', name: 'Philippines', language: 'en', languageName: 'English', continent: 'Asia', icon: 'icons/flags/philippines.svg' },
  { code: 'RW', name: 'Rwanda', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/rwanda.svg' },
  { code: 'LC', name: 'St Lucia', language: 'en', languageName: 'English', continent: 'North America', icon: 'icons/flags/st lucia.svg' },
  { code: 'VC', name: 'St Vincent and the Grenadines', language: 'en', languageName: 'English', continent: 'North America', icon: 'icons/flags/st vincent and the grenadines.svg' },
  { code: 'WS', name: 'Samoa', language: 'en', languageName: 'English', continent: 'Oceania', icon: 'icons/flags/samoa.svg' },
  { code: 'SC', name: 'Seychelles', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/seychelles.svg' },
  { code: 'SL', name: 'Sierra Leone', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/sierra leone.svg' },
  { code: 'SB', name: 'Solomon Islands', language: 'en', languageName: 'English', continent: 'Oceania', icon: 'icons/flags/solomon islands.svg' },
  { code: 'SZ', name: 'Swaziland', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/swaziland.svg' },
  { code: 'TZ', name: 'Tanzania', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/tanzania.svg' },
  { code: 'TO', name: 'Tonga', language: 'en', languageName: 'English', continent: 'Oceania', icon: 'icons/flags/tonga.svg' },
  { code: 'TT', name: 'Trinidad and Tobago', language: 'en', languageName: 'English', continent: 'North America', icon: 'icons/flags/trinidad and tobago.svg' },
  { code: 'TV', name: 'Tuvalu', language: 'en', languageName: 'English', continent: 'Oceania', icon: 'icons/flags/tuvalu.svg' },
  { code: 'UG', name: 'Uganda', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/uganda.svg' },
  { code: 'VU', name: 'Vanuatu', language: 'en', languageName: 'English', continent: 'Oceania', icon: 'icons/flags/vanuatu.svg' },
  { code: 'ZM', name: 'Zambia', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/zambia.svg' },
  { code: 'ZW', name: 'Zimbabwe', language: 'en', languageName: 'English', continent: 'Africa', icon: 'icons/flags/zimbabwe.svg' },

  // Portuguese-speaking countries (pt)
  { code: 'BR', name: 'Brazil', language: 'pt', languageName: 'Portuguese', continent: 'South America', icon: 'icons/flags/brazil.svg' },
  { code: 'PT', name: 'Portugal', language: 'pt', languageName: 'Portuguese', continent: 'Europe', icon: 'icons/flags/portugal.svg' },
  { code: 'AO', name: 'Angola', language: 'pt', languageName: 'Portuguese', continent: 'Africa', icon: 'icons/flags/angola.svg' },
  { code: 'MZ', name: 'Mozambique', language: 'pt', languageName: 'Portuguese', continent: 'Africa', icon: 'icons/flags/mozambique.svg' },
  { code: 'GW', name: 'Guinea Bissau', language: 'pt', languageName: 'Portuguese', continent: 'Africa', icon: 'icons/flags/guinea bissau.svg' },
  { code: 'TL', name: 'East Timor', language: 'pt', languageName: 'Portuguese', continent: 'Asia', icon: 'icons/flags/East Timor.svg' },
  { code: 'CV', name: 'Cape Verde', language: 'pt', languageName: 'Portuguese', continent: 'Africa', icon: 'icons/flags/cape verde.svg' },
  { code: 'ST', name: 'Sao Tome and Principe', language: 'pt', languageName: 'Portuguese', continent: 'Africa', icon: 'icons/flags/sao tome and prince.svg' },

  // Spanish-speaking countries (es)
  { code: 'ES', name: 'Spain', language: 'es', languageName: 'Spanish', continent: 'Europe', icon: 'icons/flags/spain.svg' },
  { code: 'MX', name: 'Mexico', language: 'es', languageName: 'Spanish', continent: 'North America', icon: 'icons/flags/mexico.svg' },
  { code: 'AR', name: 'Argentina', language: 'es', languageName: 'Spanish', continent: 'South America', icon: 'icons/flags/argentina.svg' },
  { code: 'CO', name: 'Colombia', language: 'es', languageName: 'Spanish', continent: 'South America', icon: 'icons/flags/colombia.svg' },
  { code: 'PE', name: 'Peru', language: 'es', languageName: 'Spanish', continent: 'South America', icon: 'icons/flags/peru.svg' },
  { code: 'VE', name: 'Venezuela', language: 'es', languageName: 'Spanish', continent: 'South America', icon: 'icons/flags/venezuela.svg' },
  { code: 'CL', name: 'Chile', language: 'es', languageName: 'Spanish', continent: 'South America', icon: 'icons/flags/chile.svg' },
  { code: 'EC', name: 'Ecuador', language: 'es', languageName: 'Spanish', continent: 'South America', icon: 'icons/flags/ecuador.svg' },
  { code: 'GT', name: 'Guatemala', language: 'es', languageName: 'Spanish', continent: 'North America', icon: 'icons/flags/guatemala.svg' },
  { code: 'CU', name: 'Cuba', language: 'es', languageName: 'Spanish', continent: 'North America', icon: 'icons/flags/cuba.svg' },
  { code: 'BO', name: 'Bolivia', language: 'es', languageName: 'Spanish', continent: 'South America', icon: 'icons/flags/bolivia.svg' },
  { code: 'DO', name: 'Dominican Republic', language: 'es', languageName: 'Spanish', continent: 'North America', icon: 'icons/flags/dominican republic.svg' },
  { code: 'HN', name: 'Honduras', language: 'es', languageName: 'Spanish', continent: 'North America', icon: 'icons/flags/honduras.svg' },
  { code: 'PY', name: 'Paraguay', language: 'es', languageName: 'Spanish', continent: 'South America', icon: 'icons/flags/paraguay.svg' },
  { code: 'SV', name: 'El Salvador', language: 'es', languageName: 'Spanish', continent: 'North America', icon: 'icons/flags/el salvador.svg' },
  { code: 'NI', name: 'Nicaragua', language: 'es', languageName: 'Spanish', continent: 'North America', icon: 'icons/flags/nicaragua.svg' },
  { code: 'CR', name: 'Costa Rica', language: 'es', languageName: 'Spanish', continent: 'North America', icon: 'icons/flags/costa rica.svg' },
  { code: 'PA', name: 'Panama', language: 'es', languageName: 'Spanish', continent: 'North America', icon: 'icons/flags/panama.svg' },
  { code: 'UY', name: 'Uruguay', language: 'es', languageName: 'Spanish', continent: 'South America', icon: 'icons/flags/uruguay.svg' },
  { code: 'PR', name: 'Puerto Rico', language: 'es', languageName: 'Spanish', continent: 'North America', icon: 'icons/flags/puerto rico.svg' },

  // French-speaking countries (fr)
  { code: 'FR', name: 'France', language: 'fr', languageName: 'French', continent: 'Europe', icon: 'icons/flags/france.svg' },
  { code: 'BE', name: 'Belgium', language: 'fr', languageName: 'French', continent: 'Europe', icon: 'icons/flags/belgium.svg' },
  { code: 'CD', name: 'Democratic Republic of Congo', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/democratic republic of congo.svg' },
  { code: 'CI', name: 'Ivory Coast', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/ivory coast.svg' },
  { code: 'CM', name: 'Cameroon', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/cameroon.svg' },
  { code: 'MG', name: 'Madagascar', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/madagascar.svg' },
  { code: 'SN', name: 'Senegal', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/senegal.svg' },
  { code: 'ML', name: 'Mali', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/mali.svg' },
  { code: 'BF', name: 'Burkina Faso', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/burkina faso.svg' },
  { code: 'NE', name: 'Niger', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/niger.svg' },
  { code: 'TD', name: 'Chad', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/chad.svg' },
  { code: 'GN', name: 'Guinea', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/guinea.svg' },
  { code: 'BI', name: 'Burundi', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/burundi.svg' },
  { code: 'BJ', name: 'Benin', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/benin.svg' },
  { code: 'HT', name: 'Haiti', language: 'fr', languageName: 'French', continent: 'North America', icon: 'icons/flags/haiti.svg' },
  { code: 'TG', name: 'Togo', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/togo.svg' },
  { code: 'CG', name: 'Republic of the Congo', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/republic of the congo.svg' },
  { code: 'GA', name: 'Gabon', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/gabon.svg' },
  { code: 'DJ', name: 'Djibouti', language: 'fr', languageName: 'French', continent: 'Africa', icon: 'icons/flags/djibouti.svg' },
  { code: 'LU', name: 'Luxembourg', language: 'fr', languageName: 'French', continent: 'Europe', icon: 'icons/flags/luxembourg.svg' },
  { code: 'MC', name: 'Monaco', language: 'fr', languageName: 'French', continent: 'Europe', icon: 'icons/flags/monaco.svg' },

  // German-speaking countries (de)
  { code: 'DE', name: 'Germany', language: 'de', languageName: 'German', continent: 'Europe', icon: 'icons/flags/germany.svg' },
  { code: 'AT', name: 'Austria', language: 'de', languageName: 'German', continent: 'Europe', icon: 'icons/flags/austria.svg' },
  { code: 'LI', name: 'Liechtenstein', language: 'de', languageName: 'German', continent: 'Europe', icon: 'icons/flags/liechtenstein.svg' },
  { code: 'CH', name: 'Switzerland', language: 'de', languageName: 'German', continent: 'Europe', icon: 'icons/flags/switzerland.svg' },
  
  // Italian-speaking countries (it)
  { code: 'IT', name: 'Italy', language: 'it', languageName: 'Italian', continent: 'Europe', icon: 'icons/flags/italy.svg' },
  { code: 'SM', name: 'San Marino', language: 'it', languageName: 'Italian', continent: 'Europe', icon: 'icons/flags/san marino.svg' },
  { code: 'VA', name: 'Vatican City', language: 'it', languageName: 'Italian', continent: 'Europe', icon: 'icons/flags/vatican city.svg' },

  // Dutch-speaking countries (nl)
  { code: 'NL', name: 'Netherlands', language: 'nl', languageName: 'Dutch', continent: 'Europe', icon: 'icons/flags/netherlands.svg' },
  { code: 'SR', name: 'Suriname', language: 'nl', languageName: 'Dutch', continent: 'South America', icon: 'icons/flags/suriname.svg' },

  // Russian-speaking countries (ru)
  { code: 'RU', name: 'Russia', language: 'ru', languageName: 'Russian', continent: 'Europe', icon: 'icons/flags/russia.svg' },
  { code: 'BY', name: 'Belarus', language: 'ru', languageName: 'Russian', continent: 'Europe', icon: 'icons/flags/belarus.svg' },
  { code: 'KZ', name: 'Kazakhstan', language: 'ru', languageName: 'Russian', continent: 'Asia', icon: 'icons/flags/kazakhstan.svg' },
  { code: 'KG', name: 'Kyrgyzstan', language: 'ru', languageName: 'Russian', continent: 'Asia', icon: 'icons/flags/kyrgyzstan.svg' },

  // Japanese-speaking countries (ja)
  { code: 'JP', name: 'Japan', language: 'ja', languageName: 'Japanese', continent: 'Asia', icon: 'icons/flags/japan.svg' },

  // Korean-speaking countries (ko)
  { code: 'KR', name: 'South Korea', language: 'ko', languageName: 'Korean', continent: 'Asia', icon: 'icons/flags/south korea.svg' },
  { code: 'KP', name: 'North Korea', language: 'ko', languageName: 'Korean', continent: 'Asia', icon: 'icons/flags/north korea.svg' },

  // Chinese-speaking countries/regions (zh)
  { code: 'CN', name: 'China', language: 'zh', languageName: 'Chinese', continent: 'Asia', icon: 'icons/flags/china.svg' },
  { code: 'TW', name: 'Taiwan', language: 'zh', languageName: 'Chinese', continent: 'Asia', icon: 'icons/flags/taiwan.svg' },
  { code: 'HK', name: 'Hong Kong', language: 'zh', languageName: 'Chinese', continent: 'Asia', icon: 'icons/flags/hong kong.svg' },
  { code: 'MO', name: 'Macao', language: 'zh', languageName: 'Chinese', continent: 'Asia', icon: 'icons/flags/macao.svg' },

  // Arabic-speaking countries (ar)
  { code: 'SA', name: 'Saudi Arabia', language: 'ar', languageName: 'Arabic', continent: 'Asia', icon: 'icons/flags/saudi arabia.svg' },
  { code: 'EG', name: 'Egypt', language: 'ar', languageName: 'Arabic', continent: 'Africa', icon: 'icons/flags/egypt.svg' },
  { code: 'DZ', name: 'Algeria', language: 'ar', languageName: 'Arabic', continent: 'Africa', icon: 'icons/flags/Algeria.svg' },
  { code: 'IQ', name: 'Iraq', language: 'ar', languageName: 'Arabic', continent: 'Asia', icon: 'icons/flags/iraq.svg' },
  { code: 'SD', name: 'Sudan', language: 'ar', languageName: 'Arabic', continent: 'Africa', icon: 'icons/flags/sudan.svg' },
  { code: 'MA', name: 'Morocco', language: 'ar', languageName: 'Arabic', continent: 'Africa', icon: 'icons/flags/morocco.svg' },
  { code: 'SY', name: 'Syria', language: 'ar', languageName: 'Arabic', continent: 'Asia', icon: 'icons/flags/syria.svg' },
  { code: 'YE', name: 'Yemen', language: 'ar', languageName: 'Arabic', continent: 'Asia', icon: 'icons/flags/yemen.svg' },
  { code: 'JO', name: 'Jordan', language: 'ar', languageName: 'Arabic', continent: 'Asia', icon: 'icons/flags/jordan.svg' },
  { code: 'TN', name: 'Tunisia', language: 'ar', languageName: 'Arabic', continent: 'Africa', icon: 'icons/flags/tunisia.svg' },
  { code: 'AE', name: 'United Arab Emirates', language: 'ar', languageName: 'Arabic', continent: 'Asia', icon: 'icons/flags/united arab emirates.svg' },
  { code: 'LY', name: 'Libya', language: 'ar', languageName: 'Arabic', continent: 'Africa', icon: 'icons/flags/libya.svg' },
  { code: 'LB', name: 'Lebanon', language: 'ar', languageName: 'Arabic', continent: 'Asia', icon: 'icons/flags/lebanon.svg' },
  { code: 'PS', name: 'Palestine', language: 'ar', languageName: 'Arabic', continent: 'Asia', icon: 'icons/flags/palestine.svg' },
  { code: 'OM', name: 'Oman', language: 'ar', languageName: 'Arabic', continent: 'Asia', icon: 'icons/flags/oman.svg' },
  { code: 'KW', name: 'Kuwait', language: 'ar', languageName: 'Arabic', continent: 'Asia', icon: 'icons/flags/kuwait.svg' },
  { code: 'MR', name: 'Mauritania', language: 'ar', languageName: 'Arabic', continent: 'Africa', icon: 'icons/flags/mauritania.svg' },
  { code: 'QA', name: 'Qatar', language: 'ar', languageName: 'Arabic', continent: 'Asia', icon: 'icons/flags/qatar.svg' },
  { code: 'BH', name: 'Bahrain', language: 'ar', languageName: 'Arabic', continent: 'Asia', icon: 'icons/flags/bahrain.svg' },

  // Bengali-speaking countries (bn)
  { code: 'BD', name: 'Bangladesh', language: 'bn', languageName: 'Bengali', continent: 'Asia', icon: 'icons/flags/bangladesh.svg' },

  // Turkish-speaking countries (tr)
  { code: 'TR', name: 'Turkey', language: 'tr', languageName: 'Turkish', continent: 'Asia', icon: 'icons/flags/turkey.svg' },

  // Vietnamese-speaking countries (vi)
  { code: 'VN', name: 'Vietnam', language: 'vi', languageName: 'Vietnamese', continent: 'Asia', icon: 'icons/flags/vietnam.svg' },

  // Indonesian-speaking countries (id)
  { code: 'ID', name: 'Indonesia', language: 'id', languageName: 'Indonesian', continent: 'Asia', icon: 'icons/flags/indonesia.svg' },
  { code: 'MY', name: 'Malaysia', language: 'id', languageName: 'Indonesian', continent: 'Asia', icon: 'icons/flags/malaysia.svg' },
  { code: 'BN', name: 'Brunei', language: 'id', languageName: 'Indonesian', continent: 'Asia', icon: 'icons/flags/brunei.svg' },

  // Thai-speaking countries (th)
  { code: 'TH', name: 'Thailand', language: 'th', languageName: 'Thai', continent: 'Asia', icon: 'icons/flags/thailand.svg' },

  // Polish-speaking countries (pl)
  { code: 'PL', name: 'Poland', language: 'pl', languageName: 'Polish', continent: 'Europe', icon: 'icons/flags/poland.svg' },

  // Ukrainian-speaking countries (uk)
  { code: 'UA', name: 'Ukraine', language: 'uk', languageName: 'Ukrainian', continent: 'Europe', icon: 'icons/flags/ukraine.svg' },

  // Romanian-speaking countries (ro)
  { code: 'RO', name: 'Romania', language: 'ro', languageName: 'Romanian', continent: 'Europe', icon: 'icons/flags/romania.svg' },
  { code: 'MD', name: 'Moldova', language: 'ro', languageName: 'Romanian', continent: 'Europe', icon: 'icons/flags/moldova.svg' },

  // Czech-speaking countries (cs)
  { code: 'CZ', name: 'Czech Republic', language: 'cs', languageName: 'Czech', continent: 'Europe', icon: 'icons/flags/czech republic.svg' },

  // Greek-speaking countries (el)
  { code: 'GR', name: 'Greece', language: 'el', languageName: 'Greek', continent: 'Europe', icon: 'icons/flags/greece.svg' },
  { code: 'CY', name: 'Cyprus', language: 'el', languageName: 'Greek', continent: 'Europe', icon: 'icons/flags/cyprus.svg' },

  // Swedish-speaking countries (sv)
  { code: 'SE', name: 'Sweden', language: 'sv', languageName: 'Swedish', continent: 'Europe', icon: 'icons/flags/sweden.svg' },

  // Hungarian-speaking countries (hu)
  { code: 'HU', name: 'Hungary', language: 'hu', languageName: 'Hungarian', continent: 'Europe', icon: 'icons/flags/hungary.svg' },

  // Danish-speaking countries (da)
  { code: 'DK', name: 'Denmark', language: 'da', languageName: 'Danish', continent: 'Europe', icon: 'icons/flags/denmark.svg' },

  // Finnish-speaking countries (fi)
  { code: 'FI', name: 'Finland', language: 'fi', languageName: 'Finnish', continent: 'Europe', icon: 'icons/flags/finland.svg' },

  // Norwegian-speaking countries (no)
  { code: 'NO', name: 'Norway', language: 'no', languageName: 'Norwegian', continent: 'Europe', icon: 'icons/flags/norway.svg' },

  // Slovak-speaking countries (sk)
  { code: 'SK', name: 'Slovakia', language: 'sk', languageName: 'Slovak', continent: 'Europe', icon: 'icons/flags/slovakia.svg' },

  // Bulgarian-speaking countries (bg)
  { code: 'BG', name: 'Bulgaria', language: 'bg', languageName: 'Bulgarian', continent: 'Europe', icon: 'icons/flags/bulgaria.svg' },

  // Croatian-speaking countries (hr)
  { code: 'HR', name: 'Croatia', language: 'hr', languageName: 'Croatian', continent: 'Europe', icon: 'icons/flags/croatia.svg' },

  // Lithuanian-speaking countries (lt)
  { code: 'LT', name: 'Lithuania', language: 'lt', languageName: 'Lithuanian', continent: 'Europe', icon: 'icons/flags/lithuania.svg' },

  // Slovenian-speaking countries (sl)
  { code: 'SI', name: 'Slovenia', language: 'sl', languageName: 'Slovenian', continent: 'Europe', icon: 'icons/flags/slovenia.svg' },

  // Hebrew-speaking countries (he)
  { code: 'IL', name: 'Israel', language: 'he', languageName: 'Hebrew', continent: 'Asia', icon: 'icons/flags/israel.svg' },
]
