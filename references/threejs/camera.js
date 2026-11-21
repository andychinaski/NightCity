export function applyCameraPose(camera, pose) {
  camera.position.set(pose.x, pose.y, pose.z);
  camera.rotation.x = -pose.pitch;

  // Shift the perspective window by a percentage of its width.
  const halfWidth = Math.tan(camera.fov * Math.PI / 360) * camera.aspect / camera.zoom;
  const filmOffset = pose.frame / 100 * 2 * halfWidth * camera.getFilmWidth();
  if (camera.filmOffset !== filmOffset) {
    camera.filmOffset = filmOffset;
    camera.updateProjectionMatrix();
  }
}
