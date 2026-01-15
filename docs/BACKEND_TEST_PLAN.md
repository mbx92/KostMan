# Backend Unit & Integration Test Plan

> **Refers to:** [Implementation Plan](./IMPLEMENTATION_PLAN.md)
> **Target Framework:** Nuxt 3 (Nitro) + Drizzle ORM

## 1. Testing Technology Stack

| Component | Tool | Purpose |
|To |---|---|
| **Test Runner** | **Vitest** | Fast, Vite-native test runner compatible with Nuxt. |
| **Nuxt Utils** | **@nuxt/test-utils** | Provides Nuxt environment context (runtime config, imports). |
| **Assertions** | **Vi (Vitest)** | Built-in assertion library (Chai-compatible). |
| **Database** | **PGLocal / Docker** | Integration tests should run against a real ephemeral DB. |
| **Mocking** | **Vi.fn() / Vi.spyOn()** | Mocking external services or complex DB calls in unit tests. |

---

## 2. Test Strategy

### 2.1 Unit Tests (`/tests/unit`)
**Focus:** Pure functions, business logic helpers, and individual service methods that can be isolated from the database.

*   **Goal:** Verify logic correctness without DB overhead.
*   **Key Candidates:**
    *   Billing calculations (Proration, Total sums).
    *   Data formatting/Validation helpers.
    *   JWT Token generation/verification verification (mocking secrets).

### 2.2 Integration Tests (`/tests/integration`)
**Focus:** API Endpoints (Nitro event handlers) and Database interactions.

*   **Goal:** Verify the full flow: Request -> API Handler -> Drizzle Query -> Database -> Response.
*   **Strategy:**
    *   Use a separate **Test Database** to avoid corrupting dev data.
    *   Run seeders before suites or `beforeEach`.
    *   Clean up data `afterEach` or `afterAll`.

---

## 3. Critical Test Scenarios

### 3.1 Authentication & User
| Type | Scenario | Expected Outcome |
|---|---|---|
| **Int** | Register with valid data | 201 Created, User in DB, Password Hashed |
| **Int** | Register with duplicate email | 400 Bad Request / 409 Conflict |
| **Int** | Login with valid creds | 200 OK, Return Access Token |
| **Int** | Login with wrong password | 401 Unauthorized |
| **Unit** | Password Hashing | Verify `bcrypt.hash` is called and output differs from input |

### 3.2 Property & Room Management
| Type | Scenario | Expected Outcome |
|---|---|---|
| **Int** | Create Property (Authed) | 201 Created, `userId` matches logged in user |
| **Int** | Create Property (Unauthed) | 401 Unauthorized |
| **Int** | Get Property Details | Returns correct JSON structure with relation (Rooms) |
| **Int** | Update Other's Property | 403 Forbidden (Ownership check) |

### 3.3 Billing Engine (High Priority)
This is the most complex logic and requires extensive **Unit Testing**.

*   **Scenario 1: Standard Calculation**
    *   *Input:* Room Price (1.000.000), Electricity (100kWh * 1500), Water (50.000), Trash (20.000).
    *   *Expected:* 1.220.000.
*   **Scenario 2: Multi-month**
    *   *Input:* 3 Months, Room Price (1.000.000/mo).
    *   *Expected:* 3.000.000 + (1 month variable costs).
*   **Scenario 3: Proration (If implemented)**
    *   *Input:* Move in on 15th (30 day month).
    *   *Expected:* ~50% of Room Price.

---

## 4. Directory Structure

```text
root/
├── tests/
│   ├── unit/
│   │   ├── utils/
│   │   │   └── currency.test.ts
│   │   ├── services/
│   │   │   └── billing.test.ts
│   ├── integration/
│   │   ├── api/
│   │   │   ├── auth.test.ts
│   │   │   ├── properties.test.ts
│   │   │   └── bills.test.ts
│   ├── setup.ts        # Global test setup (DB connection, env)
│   └── fixtures/       # Mock data generators
├── vitest.config.ts
```

## 5. Implementation Steps

1.  **Install Dependencies:**
    ```bash
    npm install -D vitest @nuxt/test-utils @vue/test-utils happy-dom playbook
    ```
2.  **Configure Vitest:**
    Create `vitest.config.ts` enabling Nuxt environment.
3.  **Setup Test Database:**
    Ensure `drizzle.config.ts` can switch to a test DB based on `NODE_ENV` or `.env.test`.
4.  **Write "Happy Path" Tests:**
    Start with Auth and Basic CRUD to ensure harness works.
5.  **Write Edge Cases:**
    Focus on Billing and Access Control.
