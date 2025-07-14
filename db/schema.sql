
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT CHECK (role IN ('school_staff', 'bus_company')) NOT NULL
);

CREATE TABLE trips (
  id SERIAL PRIMARY KEY,
  tripType TEXT NOT NULL,
  date TIMESTAMP NOT NULL,
  destination TEXT NOT NULL,
  student_count INTEGER NOT NULL,
  notes TEXT,
  status TEXT CHECK (status IN ('Pending', 'Confirmed', 'Needs Attention')) DEFAULT 'Pending',
  price NUMERIC,
  requester_id INTEGER REFERENCES users(id),
  bus_type TEXT,
  driver_name TEXT
);
