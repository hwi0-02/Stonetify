const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Playlist', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER },
    title: { type: DataTypes.STRING(255) },
    description: { type: DataTypes.TEXT },
    is_public: { type: DataTypes.BOOLEAN },
  }, {
    tableName: 'playlists',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });
};