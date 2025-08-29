const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Recommendation', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER },
    playlist_id: { type: DataTypes.INTEGER },
    reason: { type: DataTypes.TEXT },
  }, {
    tableName: 'recommendations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });
};