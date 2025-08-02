const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

/**
 * Script de prueba para validar las APIs del módulo de developers
 */
class DevelopersAPITester {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/developers`;
    this.authToken = null;
  }

  async authenticate(email = 'test@developer.com', password = 'password123') {
    try {
      console.log('🔐 Autenticando usuario...');
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email,
        password
      });
      
      this.authToken = response.data.token;
      console.log('✅ Autenticación exitosa');
      return response.data;
    } catch (error) {
      console.error('❌ Error en autenticación:', error.response?.data || error.message);
      throw error;
    }
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    };
  }

  async testDashboard() {
    try {
      console.log('\n📊 Probando dashboard...');
      const response = await axios.get(`${this.baseUrl}/dashboard`, {
        headers: this.getHeaders()
      });
      
      console.log('✅ Dashboard obtenido correctamente');
      console.log('📈 Métricas:', response.data.data.metrics);
      return response.data;
    } catch (error) {
      console.error('❌ Error en dashboard:', error.response?.data || error.message);
      throw error;
    }
  }

  async testTasks() {
    try {
      console.log('\n📋 Probando obtención de tareas...');
      const response = await axios.get(`${this.baseUrl}/tasks`, {
        headers: this.getHeaders()
      });
      
      console.log('✅ Tareas obtenidas correctamente');
      console.log(`📊 Total tareas: ${response.data.data.tasks.length}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error en tareas:', error.response?.data || error.message);
      throw error;
    }
  }

  async testSprintBoard() {
    try {
      console.log('\n🏃 Probando sprint board...');
      const response = await axios.get(`${this.baseUrl}/sprint-board`, {
        headers: this.getHeaders()
      });
      
      console.log('✅ Sprint board obtenido correctamente');
      console.log('🏃 Sprint actual:', response.data.data.sprint?.name || 'No hay sprint activo');
      return response.data;
    } catch (error) {
      console.error('❌ Error en sprint board:', error.response?.data || error.message);
      // No lanzar error si no hay sprint activo
      return null;
    }
  }

  async testTimeTracking() {
    try {
      console.log('\n⏱️  Probando time tracking stats...');
      const response = await axios.get(`${this.baseUrl}/time-tracking/stats`, {
        headers: this.getHeaders()
      });
      
      console.log('✅ Stats de time tracking obtenidas correctamente');
      console.log('⏱️  Total horas:', response.data.data.totalHours);
      return response.data;
    } catch (error) {
      console.error('❌ Error en time tracking stats:', error.response?.data || error.message);
      throw error;
    }
  }

  async testActiveTimer() {
    try {
      console.log('\n⏰ Probando timer activo...');
      const response = await axios.get(`${this.baseUrl}/timer/active`, {
        headers: this.getHeaders()
      });
      
      if (response.data.data) {
        console.log('✅ Timer activo encontrado');
        console.log('⏰ Tarea:', response.data.data.task?.title);
      } else {
        console.log('ℹ️  No hay timer activo');
      }
      return response.data;
    } catch (error) {
      console.error('❌ Error en timer activo:', error.response?.data || error.message);
      throw error;
    }
  }

  async testBugReports() {
    try {
      console.log('\n🐛 Probando reportes de bugs...');
      const response = await axios.get(`${this.baseUrl}/bug-reports`, {
        headers: this.getHeaders()
      });
      
      console.log('✅ Reportes de bugs obtenidos correctamente');
      console.log(`🐛 Total bugs reportados: ${response.data.data.length}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error en bug reports:', error.response?.data || error.message);
      throw error;
    }
  }

  async testRepositories() {
    try {
      console.log('\n📂 Probando repositorios...');
      const response = await axios.get(`${this.baseUrl}/repositories`, {
        headers: this.getHeaders()
      });
      
      console.log('✅ Repositorios obtenidos correctamente');
      console.log(`📂 Total repositorios: ${response.data.data.length}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error en repositorios:', error.response?.data || error.message);
      throw error;
    }
  }

  async testCommits() {
    try {
      console.log('\n💾 Probando commits...');
      const response = await axios.get(`${this.baseUrl}/commits`, {
        headers: this.getHeaders()
      });
      
      console.log('✅ Commits obtenidos correctamente');
      console.log(`💾 Total commits: ${response.data.data.length}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error en commits:', error.response?.data || error.message);
      throw error;
    }
  }

  async testPullRequests() {
    try {
      console.log('\n🔀 Probando pull requests...');
      const response = await axios.get(`${this.baseUrl}/pull-requests`, {
        headers: this.getHeaders()
      });
      
      console.log('✅ Pull requests obtenidos correctamente');
      console.log(`🔀 Total PRs: ${response.data.data.length}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error en pull requests:', error.response?.data || error.message);
      throw error;
    }
  }

  async runAllTests() {
    console.log('🚀 Iniciando pruebas de APIs de Developers...\n');
    
    try {
      // Autenticación requerida para todas las pruebas
      await this.authenticate();

      // Ejecutar todas las pruebas
      const results = await Promise.allSettled([
        this.testDashboard(),
        this.testTasks(),
        this.testSprintBoard(),
        this.testTimeTracking(),
        this.testActiveTimer(),
        this.testBugReports(),
        this.testRepositories(),
        this.testCommits(),
        this.testPullRequests()
      ]);

      // Resumen de resultados
      console.log('\n📊 RESUMEN DE PRUEBAS:');
      console.log('='.repeat(50));
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`✅ Exitosas: ${successful}`);
      console.log(`❌ Fallidas: ${failed}`);
      console.log(`📈 Tasa de éxito: ${((successful / results.length) * 100).toFixed(1)}%`);
      
      if (failed > 0) {
        console.log('\n❌ ERRORES ENCONTRADOS:');
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.log(`- Prueba ${index + 1}: ${result.reason.message}`);
          }
        });
      } else {
        console.log('\n🎉 ¡Todas las pruebas pasaron exitosamente!');
      }

    } catch (error) {
      console.error('\n💥 Error fatal durante las pruebas:', error.message);
    }
  }
}

// Ejecutar pruebas si el script se ejecuta directamente
if (require.main === module) {
  const tester = new DevelopersAPITester();
  tester.runAllTests();
}

module.exports = DevelopersAPITester;
