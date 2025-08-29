const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('LikedPlaylist', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER },
    playlist_id: { type: DataTypes.INTEGER },
  }, {
    tableName: 'liked_playlists',
    timestamps: true,
    createdAt: 'liked_at',
    updatedAt: false,
  });
};