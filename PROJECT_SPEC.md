# Automated Bowl Kitchen - MVP Technical Specification

**Version:** 1.0
**Date:** 2025-11-13
**Status:** Draft - Ready for Implementation

---

## Executive Summary

An automated bowl ordering system where users customize bowls through a web interface, orders are stored in a database, and kitchen robots (ESP32-based) retrieve and fulfill orders. The MVP focuses on order capture and data management with device communication abstraction for future implementation.

---

## System Overview

### Architecture Diagram

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │
       ├─> SvelteKit Frontend (Nutritional Calculation)
       │
       ├─> SvelteKit API Routes
       │
       ├─> PostgreSQL Database
       │
       └─> Device Abstraction Layer
                   │
                   └─> [Future: ESP32 Kitchen Robots]
                   └─> [MVP: Mock API for Testing]
```

### Technology Stack

- **Frontend:** SvelteKit (reactive UI, SSR capable)
- **Backend:** SvelteKit API routes (Node.js)
- **Database:** PostgreSQL
- **Deployment:** AWS (specific service TBD)
- **Device Communication:** Abstracted (HTTP polling recommended for ESP32 future implementation)

---

## MVP Scope

### In Scope

1. **User Interface**
   - Bowl builder form with ingredient selection
   - Real-time nutritional facts display (client-side calculation)
   - Order submission

2. **Backend Services**
   - Order creation and storage
   - Ingredient catalog API
   - Order status management
   - Robot abstraction APIs (mocked)

3. **Database**
   - Ingredients master data
   - Order management
   - Order items with quantities
   - Robot registry (basic)

4. **Device Abstraction**
   - Mock robot interface
   - API contracts for future robot integration
   - Server-side order assignment to robots

### Explicitly Out of Scope (MVP)

- User authentication/accounts
- Payment processing
- Inventory/stock management
- Order modifications/cancellations
- Allergen tracking
- Multi-bowl orders
- Order history/analytics
- Recommendation engine
- Real ESP32 integration
- Food safety compliance features
- Pricing logic

---

## Database Schema

### Core Tables

```sql
-- Ingredient catalog
CREATE TABLE ingredients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'protein', 'base', 'vegetable', 'topping', 'dressing'

    -- Nutritional values per 100g
    calories_per_100g DECIMAL(6,2) NOT NULL,
    protein_g_per_100g DECIMAL(5,2) NOT NULL,
    carbs_g_per_100g DECIMAL(5,2) NOT NULL,
    fat_g_per_100g DECIMAL(5,2) NOT NULL,
    fiber_g_per_100g DECIMAL(5,2),

    -- Operational
    available BOOLEAN DEFAULT true,
    display_order INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order header
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,

    -- Bowl configuration
    bowl_size INTEGER NOT NULL CHECK (bowl_size IN (250, 320, 480)), -- Bowl capacity in grams

    -- Status lifecycle
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Status flow: pending -> queued -> assigned -> preparing -> ready -> completed
    -- Possible: cancelled, failed

    -- Nutritional summary (calculated from order_items)
    total_calories DECIMAL(7,2),
    total_protein_g DECIMAL(6,2),
    total_carbs_g DECIMAL(6,2),
    total_fat_g DECIMAL(6,2),
    total_fiber_g DECIMAL(6,2),
    total_weight_g DECIMAL(7,2),

    -- Robot assignment
    assigned_robot_id INTEGER REFERENCES robots(id),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Order line items
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),

    quantity_grams DECIMAL(7,2) NOT NULL CHECK (quantity_grams > 0),

    -- Assembly sequence (1, 2, 3... for robot execution order)
    sequence_order INTEGER NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Robot registry (abstraction layer)
CREATE TABLE robots (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    identifier VARCHAR(100) UNIQUE NOT NULL, -- Device ID for authentication

    status VARCHAR(50) NOT NULL DEFAULT 'offline', -- 'online', 'offline', 'busy', 'error'

    current_order_id INTEGER REFERENCES orders(id),
    last_heartbeat TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_robot ON orders(assigned_robot_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_robots_status ON robots(status);
```

### Sample Data Structure

**Ingredient Example:**
```json
{
  "id": 1,
  "name": "Grilled Chicken",
  "category": "protein",
  "calories_per_100g": 165,
  "protein_g_per_100g": 31,
  "carbs_g_per_100g": 0,
  "fat_g_per_100g": 3.6,
  "fiber_g_per_100g": 0,
  "available": true
}
```

**Order Example:**
```json
{
  "id": 42,
  "bowl_size": 480,
  "status": "queued",
  "total_calories": 450,
  "total_protein_g": 35,
  "total_carbs_g": 45,
  "total_fat_g": 12,
  "total_weight_g": 350,
  "assigned_robot_id": null,
  "created_at": "2025-11-13T10:30:00Z"
}
```

**Order Item Example:**
```json
{
  "id": 101,
  "order_id": 42,
  "ingredient_id": 1,
  "quantity_grams": 150,
  "sequence_order": 2
}
```

---

## API Specification

### User-Facing APIs

#### GET `/api/ingredients`
Returns all available ingredients with nutritional data.

**Response:**
```json
{
  "ingredients": [
    {
      "id": 1,
      "name": "Grilled Chicken",
      "category": "protein",
      "calories_per_100g": 165,
      "protein_g_per_100g": 31,
      "carbs_g_per_100g": 0,
      "fat_g_per_100g": 3.6,
      "fiber_g_per_100g": 0,
      "available": true
    }
  ]
}
```

#### POST `/api/orders`
Creates a new bowl order.

**Request:**
```json
{
  "bowl_size": 480,
  "items": [
    {
      "ingredient_id": 1,
      "quantity_grams": 150,
      "sequence_order": 1
    },
    {
      "ingredient_id": 5,
      "quantity_grams": 100,
      "sequence_order": 2
    }
  ],
  "nutritional_summary": {
    "total_calories": 450,
    "total_protein_g": 35,
    "total_carbs_g": 45,
    "total_fat_g": 12,
    "total_fiber_g": 8,
    "total_weight_g": 350
  }
}
```

**Response:**
```json
{
  "order_id": 42,
  "status": "pending",
  "created_at": "2025-11-13T10:30:00Z"
}
```

**Business Logic:**
1. Validate bowl_size is one of the allowed values (250, 320, 480)
2. Validate all ingredient IDs exist and are available
3. Validate quantities are positive and meet minimum requirement (10g per ingredient)
4. Validate total weight does not exceed selected bowl_size
5. Server recalculates nutritional values to verify client calculations
6. Create order with status `pending` and specified bowl_size
7. Create order_items records
8. Attempt to assign to available robot (status → `queued` if successful)

#### GET `/api/orders/{id}`
Retrieves order details and current status.

**Response:**
```json
{
  "id": 42,
  "bowl_size": 480,
  "status": "preparing",
  "items": [
    {
      "ingredient_name": "Grilled Chicken",
      "quantity_grams": 150,
      "sequence_order": 1
    }
  ],
  "nutritional_summary": { ... },
  "created_at": "2025-11-13T10:30:00Z",
  "assigned_robot_id": 2
}
```

---

### Robot-Facing APIs (Device Abstraction Layer)

These APIs define the contract for future ESP32 integration. For MVP, implement as callable endpoints for manual testing.

#### POST `/api/robots/register`
Robot registration (one-time setup).

**Request:**
```json
{
  "name": "Kitchen Robot 01",
  "identifier": "ESP32_ABC123"
}
```

**Response:**
```json
{
  "robot_id": 1,
  "status": "online"
}
```

#### GET `/api/robots/{robot_id}/next-order`
Robot polls for next assigned order.

**Response (order available):**
```json
{
  "order_id": 42,
  "items": [
    {
      "ingredient_id": 1,
      "ingredient_name": "Grilled Chicken",
      "quantity_grams": 150,
      "sequence_order": 1
    },
    {
      "ingredient_id": 5,
      "ingredient_name": "Quinoa",
      "quantity_grams": 100,
      "sequence_order": 2
    }
  ]
}
```

**Response (no orders):**
```json
{
  "order_id": null
}
```

**Business Logic:**
- Returns order with status `queued` OR `assigned` to this robot
- Updates order status to `assigned` and `assigned_at` timestamp
- Sets `current_order_id` on robot record

#### POST `/api/orders/{order_id}/status`
Robot updates order status.

**Request:**
```json
{
  "robot_id": 1,
  "status": "preparing",
  "timestamp": "2025-11-13T10:35:00Z"
}
```

**Valid Status Transitions:**
- `assigned` → `preparing` (robot started work)
- `preparing` → `ready` (bowl complete, ready for pickup)
- `preparing` → `failed` (error occurred)
- `ready` → `completed` (order picked up - future)

**Response:**
```json
{
  "success": true,
  "current_status": "preparing"
}
```

**Business Logic:**
- Validate robot_id matches assigned_robot_id on order
- Validate status transition is allowed
- Update order status and relevant timestamp fields
- If status is terminal (`completed`, `failed`), clear robot's `current_order_id`

#### POST `/api/robots/{robot_id}/heartbeat`
Robot sends periodic heartbeat.

**Request:**
```json
{
  "status": "online",
  "timestamp": "2025-11-13T10:35:00Z"
}
```

**Response:**
```json
{
  "success": true
}
```

**Business Logic:**
- Update `last_heartbeat` timestamp
- Update robot `status` if changed

---

## Frontend Implementation

### Bowl Builder Interface

**Components:**

1. **IngredientSelector**
   - Grouped by category (Protein, Base, Vegetables, Toppings, Dressing)
   - Quantity input (grams) per ingredient
   - Add/remove ingredients

2. **NutritionalDisplay**
   - Real-time calculated totals:
     - Total calories
     - Protein (g)
     - Carbohydrates (g)
     - Fat (g)
     - Fiber (g)
     - Total weight (g)

3. **OrderSummary**
   - Selected ingredients list
   - Quantities
   - Nutritional breakdown
   - Submit button

### Nutritional Calculation Logic (Client-Side)

```javascript
// Frontend calculation
function calculateNutrition(orderItems, ingredientsData) {
  let totals = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    weight_g: 0
  };

  orderItems.forEach(item => {
    const ingredient = ingredientsData.find(i => i.id === item.ingredient_id);
    const multiplier = item.quantity_grams / 100;

    totals.calories += ingredient.calories_per_100g * multiplier;
    totals.protein_g += ingredient.protein_g_per_100g * multiplier;
    totals.carbs_g += ingredient.carbs_g_per_100g * multiplier;
    totals.fat_g += ingredient.fat_g_per_100g * multiplier;
    totals.fiber_g += (ingredient.fiber_g_per_100g || 0) * multiplier;
    totals.weight_g += item.quantity_grams;
  });

  return totals;
}
```

**Note:** Server MUST recalculate and validate nutritional values on order submission to prevent tampering.

---

## Backend Business Logic

### Order Assignment Algorithm

When an order is created or a robot becomes available:

```typescript
async function assignOrderToRobot(orderId: number): Promise<boolean> {
  // Find available robot (status = 'online', current_order_id = null)
  const availableRobot = await db.query(`
    SELECT id FROM robots
    WHERE status = 'online'
    AND current_order_id IS NULL
    ORDER BY last_heartbeat DESC
    LIMIT 1
  `);

  if (!availableRobot) {
    return false; // No robots available, order stays in 'pending'
  }

  // Assign order to robot
  await db.query(`
    UPDATE orders
    SET assigned_robot_id = $1,
        status = 'queued',
        assigned_at = NOW()
    WHERE id = $2
  `, [availableRobot.id, orderId]);

  await db.query(`
    UPDATE robots
    SET current_order_id = $1,
        status = 'busy'
    WHERE id = $2
  `, [orderId, availableRobot.id]);

  return true;
}
```

**Trigger Points:**
- After order creation
- When robot sends heartbeat with status 'online' and no current order
- When robot completes/fails an order

### Order Status Lifecycle

```
pending → queued → assigned → preparing → ready → completed
                         ↓
                      failed
```

**Status Definitions:**
- `pending`: Order created, awaiting robot assignment
- `queued`: Order assigned to robot, waiting for robot to fetch
- `assigned`: Robot has fetched order details
- `preparing`: Robot actively preparing bowl
- `ready`: Bowl complete, awaiting pickup
- `completed`: Order fulfilled (future: picked up)
- `failed`: Error during preparation

---

## Device Abstraction Layer

### Design Principle

All robot communication goes through a service interface. MVP implementation uses mock data; future implementation swaps in real ESP32 communication (HTTP/MQTT).

### TypeScript Interface

```typescript
interface RobotService {
  // Called when robot polls for orders
  getNextOrder(robotId: number): Promise<Order | null>;

  // Called when robot updates order status
  updateOrderStatus(orderId: number, robotId: number, status: string): Promise<void>;

  // Called when robot sends heartbeat
  recordHeartbeat(robotId: number, status: string): Promise<void>;

  // Called when order is created (attempt assignment)
  attemptOrderAssignment(orderId: number): Promise<boolean>;
}

// MVP Mock Implementation
class MockRobotService implements RobotService {
  async getNextOrder(robotId: number): Promise<Order | null> {
    // Query database for assigned orders
    return await db.getAssignedOrder(robotId);
  }

  async updateOrderStatus(orderId: number, robotId: number, status: string): Promise<void> {
    // Validate and update in database
    await db.updateOrderStatus(orderId, status);
  }

  async recordHeartbeat(robotId: number, status: string): Promise<void> {
    await db.updateRobotHeartbeat(robotId, status);
  }

  async attemptOrderAssignment(orderId: number): Promise<boolean> {
    return await assignOrderToRobot(orderId);
  }
}
```

### Future ESP32 Integration Notes

**Recommended Approach: HTTP Polling**
- ESP32 sends `GET /api/robots/{id}/next-order` every 5-10 seconds
- Simple, no persistent connections needed
- Works with NAT/firewalls
- Low latency acceptable per requirements

**Alternative: MQTT via AWS IoT Core**
- More complex setup
- Better for lower latency needs
- Bidirectional communication
- Higher cost and complexity

**Decision Point:** Defer to ESP32 implementation phase.

---

## Deployment Architecture (AWS)

### MVP Deployment Options

**Option 1: AWS Amplify (Recommended for MVP)**
- Automatic build/deploy from Git
- Built-in CDN
- Serverless scaling
- Managed SSL certificates
- Easiest setup

**Option 2: AWS ECS Fargate**
- Containerized deployment
- More control
- Higher complexity
- Better for production scale

**Option 3: Traditional EC2**
- Full control
- Manual management
- Requires DevOps expertise

**Database:**
- AWS RDS PostgreSQL (managed)
- Start with smallest instance (db.t3.micro or db.t4g.micro)
- Enable automated backups

**Recommendation:** Start with Amplify + RDS for simplest MVP deployment.

---

## Testing Strategy

### Manual Testing Endpoints (Mock Robot)

Create a simple testing UI or use Postman to simulate robot behavior:

1. **Register Mock Robot:**
   ```
   POST /api/robots/register
   { "name": "Test Robot", "identifier": "MOCK_001" }
   ```

2. **Create Test Order via User Interface**

3. **Fetch Order as Robot:**
   ```
   GET /api/robots/1/next-order
   ```

4. **Update Order Status:**
   ```
   POST /api/orders/1/status
   { "robot_id": 1, "status": "preparing" }
   ```

5. **Complete Order:**
   ```
   POST /api/orders/1/status
   { "robot_id": 1, "status": "ready" }
   ```

### Validation Checklist

- [ ] Ingredient catalog loads in UI
- [ ] Nutritional values calculate correctly as user adds ingredients
- [ ] Order submission creates database records
- [ ] Order auto-assigns to available robot
- [ ] Robot can fetch assigned order details
- [ ] Status updates flow through system correctly
- [ ] Multiple orders queue properly when robot is busy

---

## Implementation Phases

### Phase 1: Database & API Foundation
1. Set up PostgreSQL database
2. Create schema and seed ingredient data
3. Implement API routes (all endpoints)
4. Create mock robot service

### Phase 2: Frontend Development
1. Ingredient catalog display
2. Bowl builder form
3. Real-time nutritional calculation
4. Order submission flow
5. Order status display (basic)

### Phase 3: Integration & Testing
1. End-to-end order flow testing
2. Robot API testing with mock client
3. Edge case handling (no robots available, invalid ingredients, etc.)

### Phase 4: Deployment
1. Set up AWS infrastructure
2. Deploy application
3. Configure database connection
4. Smoke testing in production

---

## Data Seeding

### Sample Ingredients Dataset

Must be created for MVP functionality:

**Proteins:**
- Grilled Chicken (165 cal/100g, 31g protein)
- Tofu (76 cal/100g, 8g protein)
- Hard Boiled Egg (155 cal/100g, 13g protein)

**Bases:**
- Quinoa (120 cal/100g, 4.4g protein, 21g carbs)
- Brown Rice (111 cal/100g, 2.6g protein, 23g carbs)
- Mixed Greens (15 cal/100g, 1.4g protein, 2.9g carbs)

**Vegetables:**
- Cherry Tomatoes (18 cal/100g, 0.9g protein)
- Cucumber (16 cal/100g, 0.7g protein)
- Avocado (160 cal/100g, 2g protein, 8.5g carbs, 15g fat)

**Dressings:**
- Olive Oil Vinaigrette (450 cal/100ml, 50g fat)
- Tahini (595 cal/100g, 17g protein, 24g fat)

**Note:** These are approximate values. For production, use validated nutritional database (USDA, etc.).

---

## Future Enhancements (Post-MVP)

### Near-Term
- User authentication and profiles
- Order history and reordering
- Multiple bowl orders
- Order cancellation
- Real-time order status updates (WebSockets)

### Medium-Term
- Inventory management and stock tracking
- Ingredient availability based on stock
- Analytics dashboard (order volume, popular ingredients)
- User preference tracking

### Long-Term
- Recommendation engine based on user history
- Health metrics integration
- Allergen and dietary restriction filtering
- Pricing and payment integration
- Multi-location support

---

## Technical Constraints & Assumptions

### Assumptions
1. Nutritional data is static (doesn't change frequently)
2. Ingredient availability is manually managed (not auto-depleted)
3. Single-bowl orders only
4. No user accounts required for MVP
5. Orders are immediate (not scheduled)
6. Robots have reliable network connectivity
7. Weight measurement accuracy handled by robot hardware

### Constraints

#### Bowl Size Constraints
1. **Fixed Bowl Sizes:** Orders must select one of three standardized bowl sizes:
   - **Small:** 250g total capacity
   - **Medium:** 320g total capacity
   - **Large:** 480g total capacity
2. **Capacity Enforcement:** Total ingredient weight cannot exceed selected bowl capacity
3. **Pricing Model:** Pricing is standardized per bowl size (not per ingredient)
4. **User Experience:** System must prevent users from exceeding bowl capacity during bowl building
5. **Validation:** Both client-side (real-time feedback) and server-side (order submission) validation required

#### Ingredient Constraints
1. **Minimum ingredient quantity:** 10g per ingredient
2. **Maximum ingredients per bowl:** TBD (suggest 10)
3. **Ingredient selection:** Users input gram amounts that must sum to ≤ selected bowl capacity

#### Operational Constraints
1. **Robot polling interval:** 5-10 seconds (configurable)
2. **Order timeout:** If not picked up by robot in 5 minutes, return to queue

---

## Security Considerations

### MVP Security Measures

1. **API Input Validation**
   - Validate all ingredient IDs exist
   - Validate quantities are positive and within limits
   - Server-side nutritional recalculation (don't trust client)

2. **Robot Authentication**
   - Robot identifier required for all robot APIs
   - Validate robot_id matches assigned_robot_id on status updates

3. **Database**
   - Use parameterized queries (prevent SQL injection)
   - Connection string in environment variables

4. **HTTPS**
   - Required for all API communication
   - Especially critical for future ESP32 communication

### Post-MVP Security Enhancements
- User authentication (JWT tokens)
- Robot authentication tokens (not just IDs)
- Rate limiting on APIs
- CORS configuration
- API key for robot registration

---

## Configuration Management

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Server
PORT=3000
NODE_ENV=production

# Robot Configuration
ROBOT_POLL_INTERVAL_MS=10000
ORDER_ASSIGNMENT_TIMEOUT_MS=300000

# Future: AWS
AWS_REGION=us-east-1
AWS_IOT_ENDPOINT=<iot-endpoint>
```

---

## Monitoring & Observability

### MVP Monitoring Requirements

1. **Application Logs**
   - Order creation events
   - Robot assignment events
   - Status update events
   - Error logs

2. **Metrics to Track**
   - Orders created per hour
   - Average order preparation time
   - Robot utilization (busy vs idle time)
   - Failed orders count

3. **Alerts** (Post-MVP)
   - Robot offline > 5 minutes
   - Orders pending > 10 minutes
   - Database connection failures

---

## Glossary

- **Bowl:** A customized food order composed of multiple ingredients
- **Order:** A single bowl request with specific ingredients and quantities
- **Robot:** ESP32-based kitchen automation device that prepares bowls
- **Sequence Order:** The assembly order for ingredients (robot executes in this order)
- **Nutritional Summary:** Calculated totals of calories, macronutrients for a bowl
- **Assignment:** The process of associating an order with a specific robot
- **Heartbeat:** Periodic status signal from robot indicating availability

---

## Contact & Support

For implementation questions or clarifications:
- Refer to this document first
- Check API examples and sample data
- Validate against database schema

---

## Document Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-13 | Initial specification | System Architect |
| 1.1 | 2025-12-02 | Added bowl size constraints (250g/320g/480g), updated database schema, API specs, and validation rules | Claude Code |

---

## Appendix A: API Request/Response Examples

### Complete Order Flow Example

**1. User loads ingredients:**
```bash
GET /api/ingredients
```

**2. User submits order:**
```bash
POST /api/orders
Content-Type: application/json

{
  "bowl_size": 320,
  "items": [
    {"ingredient_id": 1, "quantity_grams": 150, "sequence_order": 1},
    {"ingredient_id": 5, "quantity_grams": 100, "sequence_order": 2},
    {"ingredient_id": 8, "quantity_grams": 50, "sequence_order": 3}
  ],
  "nutritional_summary": {
    "total_calories": 380,
    "total_protein_g": 42,
    "total_carbs_g": 32,
    "total_fat_g": 9,
    "total_fiber_g": 6,
    "total_weight_g": 300
  }
}

Response: {"order_id": 42, "status": "queued"}
```

**3. Robot polls for order:**
```bash
GET /api/robots/1/next-order

Response:
{
  "order_id": 42,
  "items": [
    {"ingredient_id": 1, "ingredient_name": "Grilled Chicken", "quantity_grams": 150, "sequence_order": 1},
    {"ingredient_id": 5, "ingredient_name": "Quinoa", "quantity_grams": 100, "sequence_order": 2},
    {"ingredient_id": 8, "ingredient_name": "Cherry Tomatoes", "quantity_grams": 50, "sequence_order": 3}
  ]
}
```

**4. Robot starts preparation:**
```bash
POST /api/orders/42/status
Content-Type: application/json

{"robot_id": 1, "status": "preparing"}
```

**5. Robot completes bowl:**
```bash
POST /api/orders/42/status
Content-Type: application/json

{"robot_id": 1, "status": "ready"}
```

---

## Appendix B: Database Seed Script

```sql
-- Sample ingredient data for MVP testing
INSERT INTO ingredients (name, category, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, available) VALUES
-- Proteins
('Grilled Chicken', 'protein', 165, 31, 0, 3.6, 0, true),
('Tofu', 'protein', 76, 8, 1.9, 4.8, 0.3, true),
('Hard Boiled Egg', 'protein', 155, 13, 1.1, 11, 0, true),
('Chickpeas', 'protein', 164, 8.9, 27.4, 2.6, 7.6, true),

-- Bases
('Quinoa', 'base', 120, 4.4, 21.3, 1.9, 2.8, true),
('Brown Rice', 'base', 111, 2.6, 23, 0.9, 1.8, true),
('Mixed Greens', 'base', 15, 1.4, 2.9, 0.2, 1.3, true),

-- Vegetables
('Cherry Tomatoes', 'vegetable', 18, 0.9, 3.9, 0.2, 1.2, true),
('Cucumber', 'vegetable', 16, 0.7, 3.6, 0.1, 0.5, true),
('Avocado', 'vegetable', 160, 2, 8.5, 15, 6.7, true),
('Shredded Carrot', 'vegetable', 41, 0.9, 10, 0.2, 2.8, true),

-- Toppings
('Sunflower Seeds', 'topping', 584, 20.8, 20, 51.5, 8.6, true),
('Feta Cheese', 'topping', 264, 14.2, 4.1, 21.3, 0, true),
('Dried Cranberries', 'topping', 308, 0.2, 82.4, 1.4, 5.3, true),

-- Dressings
('Olive Oil Vinaigrette', 'dressing', 450, 0, 0, 50, 0, true),
('Tahini', 'dressing', 595, 17, 21, 54, 9.3, true),
('Balsamic Reduction', 'dressing', 88, 0.5, 17, 0.5, 0, true);

-- Sample robot for testing
INSERT INTO robots (name, identifier, status) VALUES
('Kitchen Robot 01', 'MOCK_ROBOT_001', 'online');
```

---

**END OF SPECIFICATION**
