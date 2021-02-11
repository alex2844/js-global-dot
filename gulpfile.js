const gulp = require('gulp');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify');

gulp.task('js', done => gulp.src('doT.js').pipe(babel({
	presets: ['@babel/env']
})).pipe(uglify()).pipe(gulp.dest('dist')).on('end', () => done()));

gulp.task('default', gulp.series('js'));
