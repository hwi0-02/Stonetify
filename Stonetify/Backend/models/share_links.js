const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ShareLink', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    playlist_id: { type: DataTypes.INTEGER },
    share_url: { type: DataTypes.STRING(500) },
    qr_code_url: { type: DataTypes.STRING(500) },
  }, {
    tableName: 'share_links',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });
};