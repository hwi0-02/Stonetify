const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('RecentView', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER },
    playlist_id: { type: DataTypes.INTEGER },
  }, {
    tableName: 'recent_views',
    timestamps: true,
    createdAt: 'viewed_at',
    updatedAt: false,
  });
};