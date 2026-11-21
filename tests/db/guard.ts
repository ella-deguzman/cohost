// Kept free of imports so the test setup can use it on its own.
export function assertTestDb(url: string) {
  const name = new URL(url).pathname.replace("/", "");
  if (!/test/i.test(name)) {
    throw new Error(`Refusing to run against "${name}". The test database's name must contain "test".`);
  }
}
