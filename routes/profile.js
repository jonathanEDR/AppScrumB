const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const User = require('../models/User');

// ==================== RUTAS DE PERFIL/CV ====================

/**
 * GET /api/profile/my-cv
 * Obtener CV del usuario autenticado
 */
router.get('/my-cv', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-clerk_id -__v');
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    res.json({
      status: 'success',
      user: user
    });
  } catch (error) {
    console.error('Error obteniendo CV:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al obtener el CV',
      error: error.message 
    });
  }
});

/**
 * GET /api/profile/cv/:userId
 * Obtener CV de un usuario específico (solo super_admin)
 */
router.get('/cv/:userId', authenticate, async (req, res) => {
  try {
    // Verificar que el usuario autenticado es super_admin
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        status: 'error',
        message: 'No tienes permisos para ver este CV' 
      });
    }

    const user = await User.findById(req.params.userId)
      .select('-clerk_id -__v');
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    res.json({
      status: 'success',
      user: user
    });
  } catch (error) {
    console.error('Error obteniendo CV:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al obtener el CV',
      error: error.message 
    });
  }
});

/**
 * PUT /api/profile/personal-info
 * Actualizar información personal
 */
router.put('/personal-info', authenticate, async (req, res) => {
  try {
    const { 
      phone, 
      city, 
      country, 
      linkedin, 
      github, 
      portfolio, 
      bio 
    } = req.body;

    const updateData = {};
    
    if (phone !== undefined) updateData['profile.phone'] = phone;
    if (city !== undefined) updateData['profile.location.city'] = city;
    if (country !== undefined) updateData['profile.location.country'] = country;
    if (linkedin !== undefined) updateData['profile.links.linkedin'] = linkedin;
    if (github !== undefined) updateData['profile.links.github'] = github;
    if (portfolio !== undefined) updateData['profile.links.portfolio'] = portfolio;
    if (bio !== undefined) updateData['profile.bio'] = bio;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    res.json({
      status: 'success',
      message: 'Información personal actualizada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error actualizando información personal:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al actualizar información personal',
      error: error.message 
    });
  }
});

/**
 * PUT /api/profile/professional-info
 * Actualizar información profesional
 */
router.put('/professional-info', authenticate, async (req, res) => {
  try {
    const { title, specialty, yearsOfExperience, availability } = req.body;

    const updateData = {};
    
    if (title !== undefined) updateData['profile.professional.title'] = title;
    if (specialty !== undefined) updateData['profile.professional.specialty'] = specialty;
    if (yearsOfExperience !== undefined) updateData['profile.professional.yearsOfExperience'] = yearsOfExperience;
    if (availability !== undefined) updateData['profile.professional.availability'] = availability;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    res.json({
      status: 'success',
      message: 'Información profesional actualizada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error actualizando información profesional:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al actualizar información profesional',
      error: error.message 
    });
  }
});

/**
 * PUT /api/profile/photo
 * Actualizar foto de perfil
 */
router.put('/photo', authenticate, async (req, res) => {
  try {
    const { photoUrl, photoPublicId } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 
        $set: { 
          'profile.photo': photoUrl,
          'profile.photoPublicId': photoPublicId
        } 
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    res.json({
      status: 'success',
      message: 'Foto de perfil actualizada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error actualizando foto de perfil:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al actualizar foto de perfil',
      error: error.message 
    });
  }
});

/**
 * POST /api/profile/skills
 * Agregar habilidad
 */
router.post('/skills', authenticate, async (req, res) => {
  try {
    const { name, category, level } = req.body;

    if (!name) {
      return res.status(400).json({ 
        status: 'error',
        message: 'El nombre de la habilidad es requerido' 
      });
    }

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    // Verificar límite de habilidades
    if (user.skills.length >= 20) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Has alcanzado el límite máximo de 20 habilidades' 
      });
    }

    // Verificar si la habilidad ya existe
    const skillExists = user.skills.some(skill => 
      skill.name.toLowerCase() === name.toLowerCase()
    );

    if (skillExists) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Esta habilidad ya está en tu lista' 
      });
    }

    user.skills.push({ name, category, level });
    await user.save();

    res.json({
      status: 'success',
      message: 'Habilidad agregada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error agregando habilidad:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al agregar habilidad',
      error: error.message 
    });
  }
});

/**
 * PUT /api/profile/skills/:skillId
 * Actualizar habilidad
 */
router.put('/skills/:skillId', authenticate, async (req, res) => {
  try {
    const { name, category, level } = req.body;
    const { skillId } = req.params;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    const skill = user.skills.id(skillId);
    
    if (!skill) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Habilidad no encontrada' 
      });
    }

    if (name) skill.name = name;
    if (category) skill.category = category;
    if (level) skill.level = level;

    await user.save();

    res.json({
      status: 'success',
      message: 'Habilidad actualizada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error actualizando habilidad:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al actualizar habilidad',
      error: error.message 
    });
  }
});

/**
 * DELETE /api/profile/skills/:skillId
 * Eliminar habilidad
 */
router.delete('/skills/:skillId', authenticate, async (req, res) => {
  try {
    const { skillId } = req.params;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    user.skills.pull(skillId);
    await user.save();

    res.json({
      status: 'success',
      message: 'Habilidad eliminada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error eliminando habilidad:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al eliminar habilidad',
      error: error.message 
    });
  }
});

/**
 * POST /api/profile/experience
 * Agregar experiencia laboral
 */
router.post('/experience', authenticate, async (req, res) => {
  try {
    const { 
      company, 
      position, 
      startDate, 
      endDate, 
      isCurrent,
      description, 
      technologies,
      achievements
    } = req.body;

    if (!company || !position || !startDate) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Empresa, puesto y fecha de inicio son requeridos' 
      });
    }

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    // Verificar límite de experiencias
    if (user.experience.length >= 3) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Has alcanzado el límite máximo de 3 experiencias laborales' 
      });
    }

    user.experience.push({ 
      company, 
      position, 
      startDate, 
      endDate: isCurrent ? null : endDate,
      isCurrent: isCurrent || false,
      description, 
      technologies: technologies || [],
      achievements: achievements || []
    });
    
    await user.save();

    res.json({
      status: 'success',
      message: 'Experiencia laboral agregada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error agregando experiencia:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al agregar experiencia laboral',
      error: error.message 
    });
  }
});

/**
 * PUT /api/profile/experience/:expId
 * Actualizar experiencia laboral
 */
router.put('/experience/:expId', authenticate, async (req, res) => {
  try {
    const { expId } = req.params;
    const updateData = req.body;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    const experience = user.experience.id(expId);
    
    if (!experience) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Experiencia no encontrada' 
      });
    }

    // Actualizar campos
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        experience[key] = updateData[key];
      }
    });

    // Si es trabajo actual, endDate debe ser null
    if (updateData.isCurrent) {
      experience.endDate = null;
    }

    await user.save();

    res.json({
      status: 'success',
      message: 'Experiencia laboral actualizada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error actualizando experiencia:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al actualizar experiencia laboral',
      error: error.message 
    });
  }
});

/**
 * DELETE /api/profile/experience/:expId
 * Eliminar experiencia laboral
 */
router.delete('/experience/:expId', authenticate, async (req, res) => {
  try {
    const { expId } = req.params;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    user.experience.pull(expId);
    await user.save();

    res.json({
      status: 'success',
      message: 'Experiencia laboral eliminada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error eliminando experiencia:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al eliminar experiencia laboral',
      error: error.message 
    });
  }
});

/**
 * POST /api/profile/education
 * Agregar educación
 */
router.post('/education', authenticate, async (req, res) => {
  try {
    const { 
      institution, 
      degree, 
      field,
      level,
      startDate, 
      endDate, 
      status,
      description
    } = req.body;

    if (!institution || !degree || !startDate) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Institución, título y fecha de inicio son requeridos' 
      });
    }

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    // Verificar límite de educación
    if (user.education.length >= 3) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Has alcanzado el límite máximo de 3 títulos educativos' 
      });
    }

    user.education.push({ 
      institution, 
      degree, 
      field,
      level,
      startDate, 
      endDate,
      status: status || 'completed',
      description
    });
    
    await user.save();

    res.json({
      status: 'success',
      message: 'Educación agregada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error agregando educación:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al agregar educación',
      error: error.message 
    });
  }
});

/**
 * PUT /api/profile/education/:eduId
 * Actualizar educación
 */
router.put('/education/:eduId', authenticate, async (req, res) => {
  try {
    const { eduId } = req.params;
    const updateData = req.body;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    const education = user.education.id(eduId);
    
    if (!education) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Educación no encontrada' 
      });
    }

    // Actualizar campos
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        education[key] = updateData[key];
      }
    });

    await user.save();

    res.json({
      status: 'success',
      message: 'Educación actualizada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error actualizando educación:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al actualizar educación',
      error: error.message 
    });
  }
});

/**
 * DELETE /api/profile/education/:eduId
 * Eliminar educación
 */
router.delete('/education/:eduId', authenticate, async (req, res) => {
  try {
    const { eduId } = req.params;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    user.education.pull(eduId);
    await user.save();

    res.json({
      status: 'success',
      message: 'Educación eliminada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error eliminando educación:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al eliminar educación',
      error: error.message 
    });
  }
});

/**
 * POST /api/profile/projects
 * Agregar proyecto
 */
router.post('/projects', authenticate, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      url,
      imageUrl,
      imagePublicId,
      technologies,
      date,
      role
    } = req.body;

    if (!name || !description) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Nombre y descripción son requeridos' 
      });
    }

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    // Verificar límite de proyectos
    if (user.projects.length >= 3) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Has alcanzado el límite máximo de 3 proyectos' 
      });
    }

    user.projects.push({ 
      name, 
      description, 
      url,
      imageUrl,
      imagePublicId,
      technologies: technologies || [],
      date: date || new Date(),
      role
    });
    
    await user.save();

    res.json({
      status: 'success',
      message: 'Proyecto agregado correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error agregando proyecto:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al agregar proyecto',
      error: error.message 
    });
  }
});

/**
 * PUT /api/profile/projects/:projectId
 * Actualizar proyecto
 */
router.put('/projects/:projectId', authenticate, async (req, res) => {
  try {
    const { projectId } = req.params;
    const updateData = req.body;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    const project = user.projects.id(projectId);
    
    if (!project) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Proyecto no encontrado' 
      });
    }

    // Actualizar campos
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        project[key] = updateData[key];
      }
    });

    await user.save();

    res.json({
      status: 'success',
      message: 'Proyecto actualizado correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error actualizando proyecto:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al actualizar proyecto',
      error: error.message 
    });
  }
});

/**
 * DELETE /api/profile/projects/:projectId
 * Eliminar proyecto
 */
router.delete('/projects/:projectId', authenticate, async (req, res) => {
  try {
    const { projectId } = req.params;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    user.projects.pull(projectId);
    await user.save();

    res.json({
      status: 'success',
      message: 'Proyecto eliminado correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error eliminando proyecto:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al eliminar proyecto',
      error: error.message 
    });
  }
});

/**
 * POST /api/profile/certifications
 * Agregar certificación
 */
router.post('/certifications', authenticate, async (req, res) => {
  try {
    const { 
      name, 
      issuer, 
      issueDate,
      expirationDate,
      credentialId,
      credentialUrl
    } = req.body;

    if (!name || !issuer || !issueDate) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Nombre, emisor y fecha de emisión son requeridos' 
      });
    }

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    // Verificar límite de certificaciones
    if (user.certifications.length >= 3) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Has alcanzado el límite máximo de 3 certificaciones' 
      });
    }

    user.certifications.push({ 
      name, 
      issuer, 
      issueDate,
      expirationDate,
      credentialId,
      credentialUrl
    });
    
    await user.save();

    res.json({
      status: 'success',
      message: 'Certificación agregada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error agregando certificación:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al agregar certificación',
      error: error.message 
    });
  }
});

/**
 * PUT /api/profile/certifications/:certId
 * Actualizar certificación
 */
router.put('/certifications/:certId', authenticate, async (req, res) => {
  try {
    const { certId } = req.params;
    const updateData = req.body;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    const certification = user.certifications.id(certId);
    
    if (!certification) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Certificación no encontrada' 
      });
    }

    // Actualizar campos
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        certification[key] = updateData[key];
      }
    });

    await user.save();

    res.json({
      status: 'success',
      message: 'Certificación actualizada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error actualizando certificación:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al actualizar certificación',
      error: error.message 
    });
  }
});

/**
 * DELETE /api/profile/certifications/:certId
 * Eliminar certificación
 */
router.delete('/certifications/:certId', authenticate, async (req, res) => {
  try {
    const { certId } = req.params;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        status: 'error',
        message: 'Usuario no encontrado' 
      });
    }

    user.certifications.pull(certId);
    await user.save();

    res.json({
      status: 'success',
      message: 'Certificación eliminada correctamente',
      user: user
    });
  } catch (error) {
    console.error('Error eliminando certificación:', error);
    res.status(400).json({ 
      status: 'error',
      message: 'Error al eliminar certificación',
      error: error.message 
    });
  }
});

module.exports = router;
