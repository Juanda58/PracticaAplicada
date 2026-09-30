-- Electrolineras JAMB · datos semilla
-- Ejecutar después de schema.sql. Los usuarios se crean desde Auth > Users.

insert into public.stations (id, name, address, city, distance_km, status, price_per_kwh, rating, amenities, notes, active_vehicles, waiting_vehicles, avg_wait_min)
values
  ('00000000-0000-0000-0000-000000000001', 'JAMB Chapinero Norte', 'Cra. 13 #63-45, Bogotá', 'Bogotá', 1.2, 'disponible', 780, 4.7, array['Cafetería','Wifi','Techado'], 'Estación insignia de la red, cerca a la Zona G.', 2, 1, 12),
  ('00000000-0000-0000-0000-000000000002', 'JAMB Centro Comercial Sopó', 'Autopista Norte km 26, Sopó', 'Sopó', 3.8, 'ocupada', 720, 4.5, array['Baños','Restaurantes','Parqueadero'], 'Dentro del parqueadero del centro comercial, nivel -1.', 4, 2, 24),
  ('00000000-0000-0000-0000-000000000003', 'JAMB Terminal Salitre', 'Av. Boyacá #22-10, Bogotá', 'Bogotá', 5.6, 'disponible', 810, 4.8, array['Carga rápida','Seguridad 24/7'], 'Carga ultrarrápida, ideal antes de viajes largos.', 1, 0, 0),
  ('00000000-0000-0000-0000-000000000004', 'JAMB Parque La Colina', 'Cl. 145 #103-60, Bogotá', 'Bogotá', 7.1, 'mantenimiento', 760, 4.2, array['Zona verde','Parqueadero'], 'En mantenimiento programado.', 0, 0, 0)
on conflict (id) do update set name = excluded.name, status = excluded.status, price_per_kwh = excluded.price_per_kwh, rating = excluded.rating, amenities = excluded.amenities, updated_at = now();

insert into public.station_connectors (station_id, connector_type, power, available, total)
values
  ('00000000-0000-0000-0000-000000000001', 'Tipo 2 (AC)', '22 kW', 3, 4),
  ('00000000-0000-0000-0000-000000000001', 'CCS Combo (DC)', '60 kW', 1, 2),
  ('00000000-0000-0000-0000-000000000002', 'CHAdeMO (DC)', '50 kW', 0, 2),
  ('00000000-0000-0000-0000-000000000002', 'Tipo 2 (AC)', '11 kW', 2, 6),
  ('00000000-0000-0000-0000-000000000003', 'CCS Combo (DC)', '120 kW', 2, 3),
  ('00000000-0000-0000-0000-000000000004', 'Tipo 2 (AC)', '22 kW', 0, 4)
on conflict (station_id, connector_type) do update set power = excluded.power, available = excluded.available, total = excluded.total;

insert into public.sponsors (name, website_url)
values
  ('Andes Motors', 'https://example.com/andes-motors'),
  ('GridPoint Colombia', 'https://example.com/gridpoint'),
  ('Banco Solar', 'https://example.com/banco-solar'),
  ('Movilidad Andina', 'https://example.com/movilidad-andina'),
  ('Rueda Verde Seguros', 'https://example.com/rueda-verde'),
  ('Voltia Energía', 'https://example.com/voltia')
on conflict do nothing;

-- Después de crear admin@jamb.com en Supabase Auth, ejecutar:
-- update public.profiles set role = 'admin', plan = 'Operador de red' where email = 'admin@jamb.com';
