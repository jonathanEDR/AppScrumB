const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const BugReport = require('../models/BugReport');
const User = require('../models/User');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Product = require('../models/Product'); // Agregar Product model

// Mock del middleware de autenticación ANTES de importar la ruta
jest.mock('../middleware/authenticate', () => ({
  authenticate: (req, res, next) => {
    // Usar string estático en lugar de generar con mongoose
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

describe('Developers API - Bug Reports', () => {
  let app;
  let testUser;
  let testBugReport;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Crear usuario de prueba con el mismo ID del mock de autenticación
    testUser = await User.create({
      _id: '507f1f77bcf86cd799439011', // Mismo ID que en el mock de authenticate
      clerkUserId: 'test_clerk_123',
      clerk_id: 'test_clerk_123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'Developer',
      role: 'developers'
    });

    // Crear bug report de prueba con campos correctos según modelo
    testBugReport = await BugReport.create({
      title: 'Test Bug Report',
      description: 'This is a test bug report for testing purposes',
      actualBehavior: 'The application crashes when clicking submit button', // Campo REQUERIDO
      severity: 'major', // Enum: minor, major, critical, blocker
      priority: 'high',
      status: 'open',
      type: 'bug',
      reportedBy: testUser._id, // Campo correcto: reportedBy no reporter
      expectedBehavior: 'The form should submit successfully',
      stepsToReproduce: '1. Open form\n2. Fill fields\n3. Click submit'
    });
  });

  describe('GET /api/developers/bug-reports', () => {
    it('should return list of bug reports', async () => {
      const response = await request(app)
        .get('/api/developers/bug-reports')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter bug reports by status', async () => {
      const response = await request(app)
        .get('/api/developers/bug-reports?status=open')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(bug => {
        expect(bug.status).toBe('open');
      });
    });

    it('should filter bug reports by severity', async () => {
      const response = await request(app)
        .get('/api/developers/bug-reports?severity=major') // Usar 'major' que es el valor del bug de test
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(bug => {
        expect(bug.severity).toBe('major');
      });
    });
  });

  describe('POST /api/developers/bug-reports', () => {
    it('should create a new bug report', async () => {
      const newBug = {
        title: 'New Test Bug',
        description: 'This is a new bug created in test',
        actualBehavior: 'Application shows error message',
        expectedBehavior: 'Application should work properly',
        severity: 'minor', // Enum: minor, major, critical, blocker
        priority: 'medium',
        type: 'bug',
        stepsToReproduce: '1. Open app\n2. Reproduce issue'
      };

      const response = await request(app)
        .post('/api/developers/bug-reports')
        .send(newBug)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.title).toBe(newBug.title);
      expect(response.body.data.status).toBe('open');
    });

    it('should validate required fields', async () => {
      const invalidBug = {
        title: 'Bad Bug Title',
        description: 'This is a description without actualBehavior field'
        // Falta actualBehavior que es requerido
      };

      const response = await request(app)
        .post('/api/developers/bug-reports')
        .send(invalidBug)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate title length', async () => {
      const invalidBug = {
        title: 'Bad', // Título muy corto (menos de 5 caracteres)
        description: 'This description is long enough to pass validation',
        actualBehavior: 'The app crashes unexpectedly'
      };

      const response = await request(app)
        .post('/api/developers/bug-reports')
        .send(invalidBug)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/developers/bug-reports/:id', () => {
    it('should return a specific bug report', async () => {
      const response = await request(app)
        .get(`/api/developers/bug-reports/${testBugReport._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testBugReport._id.toString());
      expect(response.body.data.title).toBe(testBugReport.title);
    });

    it('should return 404 for non-existent bug report', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/developers/bug-reports/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Bug report no encontrado');
    });

    it('should return 500 for invalid ObjectId', async () => {
      const response = await request(app)
        .get('/api/developers/bug-reports/invalid-id')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/developers/bug-reports/:id', () => {
    it('should update a bug report', async () => {
      const updates = {
        title: 'Updated Bug Title',
        severity: 'critical', // Enum válido: minor, major, critical, blocker
        actualBehavior: 'Updated actual behavior description'
      };

      const response = await request(app)
        .put(`/api/developers/bug-reports/${testBugReport._id}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updates.title);
      expect(response.body.data.severity).toBe(updates.severity);
    });

    it('should not update non-allowed fields', async () => {
      const updates = {
        reportedBy: new mongoose.Types.ObjectId(), // Usar reportedBy, no reporter
        createdAt: new Date()
      };

      const response = await request(app)
        .put(`/api/developers/bug-reports/${testBugReport._id}`)
        .send(updates)
        .expect(200);

      expect(response.body.data.reportedBy).not.toBe(updates.reportedBy);
    });
  });

  describe('PATCH /api/developers/bug-reports/:id/status', () => {
    it('should change bug report status', async () => {
      const statusUpdate = {
        status: 'in_progress',
        comment: 'Starting work on this bug'
      };

      const response = await request(app)
        .patch(`/api/developers/bug-reports/${testBugReport._id}/status`)
        .send(statusUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('in_progress');
    });

    it('should mark bug as resolved with resolution', async () => {
      const statusUpdate = {
        status: 'resolved',
        resolution: 'fixed',
        comment: 'Bug has been fixed'
      };

      const response = await request(app)
        .patch(`/api/developers/bug-reports/${testBugReport._id}/status`)
        .send(statusUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('resolved');
      expect(response.body.data.resolution).toBe('fixed');
      expect(response.body.data.resolvedAt).toBeDefined();
    });

    it('should create system comment on status change', async () => {
      const statusUpdate = {
        status: 'in_progress',
        comment: 'Working on it'
      };

      await request(app)
        .patch(`/api/developers/bug-reports/${testBugReport._id}/status`)
        .send(statusUpdate)
        .expect(200);

      // Verificar que se creó el comentario
      const comments = await Comment.find({
        resourceType: 'BugReport',
        resourceId: testBugReport._id
      });

      expect(comments.length).toBeGreaterThan(0);
      expect(comments[0].type).toBe('status_change');
    });
  });

  describe('DELETE /api/developers/bug-reports/:id', () => {
    it('should soft delete a bug report', async () => {
      const response = await request(app)
        .delete(`/api/developers/bug-reports/${testBugReport._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verificar que el bug fue marcado como cerrado
      const deletedBug = await BugReport.findById(testBugReport._id);
      expect(deletedBug.status).toBe('closed');
      expect(deletedBug.resolution).toBe('wont_fix');
    });
  });

  describe('GET /api/developers/bug-reports/:id/comments', () => {
    beforeEach(async () => {
      // Crear algunos comentarios de prueba
      await Comment.create({
        resourceType: 'BugReport',
        resourceId: testBugReport._id,
        author: testUser._id,
        content: 'First comment',
        type: 'comment'
      });

      await Comment.create({
        resourceType: 'BugReport',
        resourceId: testBugReport._id,
        author: testUser._id,
        content: 'Second comment',
        type: 'comment'
      });
    });

    it('should return comments for a bug report', async () => {
      const response = await request(app)
        .get(`/api/developers/bug-reports/${testBugReport._id}/comments`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should paginate comments', async () => {
      const response = await request(app)
        .get(`/api/developers/bug-reports/${testBugReport._id}/comments?page=1&limit=1`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
    });
  });

  describe('POST /api/developers/bug-reports/:id/comments', () => {
    it('should add a comment to bug report', async () => {
      const newComment = {
        content: 'This is a test comment'
      };

      const response = await request(app)
        .post(`/api/developers/bug-reports/${testBugReport._id}/comments`)
        .send(newComment)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe(newComment.content);
      expect(response.body.data.resourceType).toBe('BugReport');
      expect(response.body.data.resourceId.toString()).toBe(testBugReport._id.toString());
    });

    it('should validate empty comment', async () => {
      const invalidComment = {
        content: ''
      };

      const response = await request(app)
        .post(`/api/developers/bug-reports/${testBugReport._id}/comments`)
        .send(invalidComment)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should support reply to comment (parentComment)', async () => {
      // Crear comentario padre
      const parentComment = await Comment.create({
        resourceType: 'BugReport',
        resourceId: testBugReport._id,
        author: testUser._id,
        content: 'Parent comment',
        type: 'comment'
      });

      const reply = {
        content: 'Reply to parent',
        parentComment: parentComment._id
      };

      const response = await request(app)
        .post(`/api/developers/bug-reports/${testBugReport._id}/comments`)
        .send(reply)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.parentComment.toString()).toBe(parentComment._id.toString());
    });
  });
});

describe('Developers API - Performance', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  it('should respond within acceptable time for dashboard', async () => {
    const startTime = Date.now();
    
    await request(app)
      .get('/api/developers/dashboard')
      .expect(200);

    const responseTime = Date.now() - startTime;
    
    // Dashboard debe responder en menos de 1 segundo
    expect(responseTime).toBeLessThan(1000);
  });

  it('should handle concurrent requests', async () => {
    const requests = [];
    
    for (let i = 0; i < 10; i++) {
      requests.push(
        request(app).get('/api/developers/bug-reports')
      );
    }

    const responses = await Promise.all(requests);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
