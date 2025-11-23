const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const TimeTracking = require('../models/TimeTracking');
const User = require('../models/User');
const Task = require('../models/Task');
const Sprint = require('../models/Sprint');

// Mock del middleware de autenticación ANTES de importar la ruta
jest.mock('../middleware/authenticate', () => ({
  authenticate: (req, res, next) => {
    req.user = {
      id: '507f1f77bcf86cd799439011',
      role: 'developers',
      email: 'test@example.com',
      name: 'Test Developer'
    };
    next();
  }
}));

// Importar la ruta DESPUÉS del mock
const developersRouter = require('../routes/developers');

// Crear app de prueba
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/developers', developersRouter);
  
  return app;
};

describe('Developers API - Time Tracking', () => {
  let app;
  let testUser;
  let testSprint;
  let testTask;
  let testTimeEntry;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Crear usuario de prueba con el mismo ID del mock
    testUser = await User.create({
      _id: '507f1f77bcf86cd799439011',
      clerkUserId: 'test_clerk_123',
      clerk_id: 'test_clerk_123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'Developer',
      role: 'developers'
    });

    // Crear producto de prueba (requerido por Sprint)
    const Product = require('../models/Product');
    const testProduct = await Product.create({
      nombre: 'Test Product',
      descripcion: 'Product for testing',
      responsable: testUser._id,
      created_by: testUser._id
    });

    // Crear sprint de prueba
    testSprint = await Sprint.create({
      nombre: 'Sprint 1',
      objetivo: 'Test Sprint',
      fecha_inicio: new Date(),
      fecha_fin: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estado: 'activo',
      producto: testProduct._id,
      created_by: testUser._id
    });

    // Crear task de prueba
    testTask = await Task.create({
      title: 'Test Task',
      description: 'Test task for time tracking',
      status: 'in_progress',
      priority: 'medium',
      sprint: testSprint._id,
      assignee: testUser._id,
      reporter: testUser._id,
      estimatedHours: 8
    });

    // Crear entrada de tiempo de prueba
    testTimeEntry = await TimeTracking.create({
      user: testUser._id,
      task: testTask._id,
      date: new Date(),
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 horas atrás
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hora atrás
      hours: 1,
      description: 'Working on test task'
    });
  });

  describe('GET /api/developers/time-tracking/stats', () => {
    it('should return time tracking statistics', async () => {
      const response = await request(app)
        .get('/api/developers/time-tracking/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalHoursToday');
      expect(response.body.data).toHaveProperty('totalHoursWeek');
      expect(response.body.data).toHaveProperty('totalHoursMonth');
    });

    it('should calculate hours correctly', async () => {
      // Crear entrada de hoy
      await TimeTracking.create({
        user: testUser._id,
        task: testTask._id,
        date: new Date(),
        startTime: new Date(),
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        hours: 3,
        description: 'Recent work'
      });

      const response = await request(app)
        .get('/api/developers/time-tracking/stats')
        .expect(200);

      expect(response.body.data.totalHoursToday).toBeGreaterThan(0);
    });
  });

  describe('GET /api/developers/time-tracking', () => {
    it('should return list of time entries', async () => {
      const response = await request(app)
        .get('/api/developers/time-tracking')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter by task', async () => {
      const response = await request(app)
        .get(`/api/developers/time-tracking?taskId=${testTask._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(entry => {
        expect(entry.task._id.toString()).toBe(testTask._id.toString());
      });
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const response = await request(app)
        .get(`/api/developers/time-tracking?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      // Crear varias entradas
      for (let i = 0; i < 5; i++) {
        await TimeTracking.create({
          user: testUser._id,
          task: testTask._id,
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          startTime: new Date(),
          endTime: new Date(Date.now() + 60 * 60 * 1000),
          hours: 1,
          description: `Entry ${i}`
        });
      }

      const response = await request(app)
        .get('/api/developers/time-tracking?page=1&limit=3')
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(3);
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('POST /api/developers/time-tracking', () => {
    it('should create a new time entry', async () => {
      const newEntry = {
        taskId: testTask._id.toString(),
        date: new Date().toISOString(),
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        description: 'New time entry'
      };

      const response = await request(app)
        .post('/api/developers/time-tracking')
        .send(newEntry)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.hours).toBeCloseTo(2, 1);
    });

    it('should validate required fields', async () => {
      const invalidEntry = {
        date: new Date().toISOString()
        // Faltan campos requeridos
      };

      const response = await request(app)
        .post('/api/developers/time-tracking')
        .send(invalidEntry)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate time range', async () => {
      const invalidEntry = {
        taskId: testTask._id.toString(),
        date: new Date().toISOString(),
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // endTime antes de startTime
        description: 'Invalid time range'
      };

      const response = await request(app)
        .post('/api/developers/time-tracking')
        .send(invalidEntry)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should prevent entries longer than 12 hours', async () => {
      const longEntry = {
        taskId: testTask._id.toString(),
        date: new Date().toISOString(),
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 15 * 60 * 60 * 1000).toISOString(), // 15 horas
        description: 'Too long'
      };

      const response = await request(app)
        .post('/api/developers/time-tracking')
        .send(longEntry)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/developers/time-tracking/:id', () => {
    it('should update a time entry', async () => {
      const updates = {
        description: 'Updated description',
        hours: 2
      };

      const response = await request(app)
        .put(`/api/developers/time-tracking/${testTimeEntry._id}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toBe(updates.description);
    });

    it('should return 404 for non-existent entry', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/developers/time-tracking/${fakeId}`)
        .send({ description: 'Update' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should only allow user to update their own entries', async () => {
      // Crear otro usuario
      const otherUser = await User.create({
        clerkUserId: 'other_user',
        clerk_id: 'other_user',
        email: 'other@example.com',
        firstName: 'Other',
        lastName: 'User',
        role: 'developers'
      });

      // Crear entrada del otro usuario
      const otherEntry = await TimeTracking.create({
        user: otherUser._id,
        task: testTask._id,
        date: new Date(),
        startTime: new Date(),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        hours: 1,
        description: 'Other user entry'
      });

      const response = await request(app)
        .put(`/api/developers/time-tracking/${otherEntry._id}`)
        .send({ description: 'Trying to update' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/developers/time-tracking/:id', () => {
    it('should delete a time entry', async () => {
      const response = await request(app)
        .delete(`/api/developers/time-tracking/${testTimeEntry._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verificar que se eliminó
      const deleted = await TimeTracking.findById(testTimeEntry._id);
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent entry', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/developers/time-tracking/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should only allow user to delete their own entries', async () => {
      const otherUser = await User.create({
        clerkUserId: 'other_user_2',
        clerk_id: 'other_user_2',
        email: 'other2@example.com',
        firstName: 'Other2',
        lastName: 'User2',
        role: 'developers'
      });

      const otherEntry = await TimeTracking.create({
        user: otherUser._id,
        task: testTask._id,
        date: new Date(),
        startTime: new Date(),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        hours: 1,
        description: 'Other user entry'
      });

      const response = await request(app)
        .delete(`/api/developers/time-tracking/${otherEntry._id}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/developers/timer/start', () => {
    it('should start a timer', async () => {
      const timerData = {
        taskId: testTask._id.toString()
      };

      const response = await request(app)
        .post('/api/developers/timer/start')
        .send(timerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.endTime).toBeNull();
    });

    it('should validate task exists', async () => {
      const fakeTaskId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post('/api/developers/timer/start')
        .send({ taskId: fakeTaskId.toString() })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should prevent multiple active timers', async () => {
      // Iniciar primer timer
      await request(app)
        .post('/api/developers/timer/start')
        .send({ taskId: testTask._id.toString() })
        .expect(201);

      // Intentar iniciar segundo timer
      const response = await request(app)
        .post('/api/developers/timer/start')
        .send({ taskId: testTask._id.toString() })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/ya tienes un timer activo/i);
    });
  });

  describe('POST /api/developers/timer/stop', () => {
    beforeEach(async () => {
      // Crear un timer activo
      await TimeTracking.create({
        user: testUser._id,
        task: testTask._id,
        date: new Date(),
        startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutos atrás
        endTime: null,
        description: 'Active timer'
      });
    });

    it('should stop an active timer', async () => {
      const response = await request(app)
        .post('/api/developers/timer/stop')
        .send({ description: 'Timer stopped' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.endTime).not.toBeNull();
      expect(response.body.data.hours).toBeGreaterThan(0);
    });

    it('should calculate hours correctly', async () => {
      const response = await request(app)
        .post('/api/developers/timer/stop')
        .expect(200);

      // Debería ser aproximadamente 0.5 horas (30 minutos)
      expect(response.body.data.hours).toBeCloseTo(0.5, 1);
    });

    it('should return error if no active timer', async () => {
      // Detener el timer primero
      await request(app)
        .post('/api/developers/timer/stop')
        .expect(200);

      // Intentar detener de nuevo
      const response = await request(app)
        .post('/api/developers/timer/stop')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/developers/timer/active', () => {
    it('should return active timer if exists', async () => {
      // Crear timer activo
      const activeTimer = await TimeTracking.create({
        user: testUser._id,
        task: testTask._id,
        date: new Date(),
        startTime: new Date(Date.now() - 15 * 60 * 1000),
        endTime: null,
        description: 'Active timer'
      });

      const response = await request(app)
        .get('/api/developers/timer/active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).not.toBeNull();
      expect(response.body.data._id).toBe(activeTimer._id.toString());
    });

    it('should return null if no active timer', async () => {
      const response = await request(app)
        .get('/api/developers/timer/active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });

    it('should calculate elapsed time', async () => {
      await TimeTracking.create({
        user: testUser._id,
        task: testTask._id,
        date: new Date(),
        startTime: new Date(Date.now() - 45 * 60 * 1000), // 45 minutos atrás
        endTime: null,
        description: 'Active timer'
      });

      const response = await request(app)
        .get('/api/developers/timer/active')
        .expect(200);

      expect(response.body.data).toHaveProperty('elapsedMinutes');
      expect(response.body.data.elapsedMinutes).toBeGreaterThan(40);
    });
  });

  describe('Time Tracking - Edge Cases', () => {
    it('should handle overlapping time entries', async () => {
      const entry1 = {
        taskId: testTask._id.toString(),
        date: new Date().toISOString(),
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        description: 'First entry'
      };

      await request(app)
        .post('/api/developers/time-tracking')
        .send(entry1)
        .expect(201);

      // Intentar crear entrada que se solapa
      const entry2 = {
        taskId: testTask._id.toString(),
        date: new Date().toISOString(),
        startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // Solapa con entry1
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        description: 'Overlapping entry'
      };

      // Este test verifica que el sistema maneje solapamientos
      const response = await request(app)
        .post('/api/developers/time-tracking')
        .send(entry2);

      // Puede ser 201 (permitido) o 400 (no permitido) dependiendo de la lógica
      expect([201, 400]).toContain(response.status);
    });

    it('should handle midnight crossing entries', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 0, 0, 0);

      const today = new Date();
      today.setHours(1, 0, 0, 0);

      const entry = {
        taskId: testTask._id.toString(),
        date: yesterday.toISOString(),
        startTime: yesterday.toISOString(),
        endTime: today.toISOString(),
        description: 'Midnight crossing'
      };

      const response = await request(app)
        .post('/api/developers/time-tracking')
        .send(entry);

      // Debería manejar correctamente (puede ser 201 o 400 dependiendo de la lógica)
      expect([201, 400]).toContain(response.status);
    });
  });

  describe('Time Tracking - Performance', () => {
    it('should handle bulk time entries efficiently', async () => {
      const entries = [];
      for (let i = 0; i < 10; i++) {
        entries.push(
          TimeTracking.create({
            user: testUser._id,
            task: testTask._id,
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
            startTime: new Date(),
            endTime: new Date(Date.now() + 60 * 60 * 1000),
            hours: 1,
            description: `Bulk entry ${i}`
          })
        );
      }

      await Promise.all(entries);

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/developers/time-tracking')
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(1000); // Menos de 1 segundo
      expect(response.body.data.length).toBeGreaterThan(10);
    });
  });
});
