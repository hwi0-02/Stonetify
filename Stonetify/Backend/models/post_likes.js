const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('PostLike', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    post_id: { type: DataTypes.INTEGER },
    user_id: { type: DataTypes.INTEGER },
  }, {
    tableName: 'post_likes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });
};