module.exports = ({ ext }) => {
  const imageTypes = ['.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.heic']
  return imageTypes.includes(ext)
}
