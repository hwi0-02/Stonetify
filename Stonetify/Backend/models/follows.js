const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Follow', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    follower_id: { type: DataTypes.INTEGER },
    following_id: { type: DataTypes.INTEGER },
  }, {
    tableName: 'follows',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });
};