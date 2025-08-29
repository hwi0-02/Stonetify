const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('PlaylistSongs', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    playlist_id: { type: DataTypes.INTEGER },
    song_id: { type: DataTypes.INTEGER },
  }, {
    tableName: 'playlist_songs',
    timestamps: true,
    createdAt: 'added_at',
    updatedAt: false,
  });
};