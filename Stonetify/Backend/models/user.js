const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING(255), unique: true },
    password: { type: DataTypes.STRING(255) },
    display_name: { type: DataTypes.STRING(255) },
    social: { type: DataTypes.STRING(100) },
    profile_image_url: { type: DataTypes.STRING(500) },
    bio: { type: DataTypes.TEXT },
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });
};