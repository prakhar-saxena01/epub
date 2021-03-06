// Less configuration
const gulp = require('gulp');
const less = require('gulp-less');
const minifyCSS = require('gulp-minify-css');
const concat = require('gulp-concat');
const rename = require('gulp-rename');
const uglify = require('gulp-uglify-es').default;
const touch = require('gulp-touch-fd');

function swallowError(error) {
	console.log(error.toString())

	this.emit('end')
 }

gulp.task('minifyLibsJS', function(cb) {
	gulp
		.src([
				'lib/bootstrap/v3/js/jquery.js',
				'lib/bootstrap/v3/js/bootstrap.min.js',
				'node_modules/jszip/dist/jszip.min.js',
				'lib/epub.js/dist/epub.js',
				//'node_modules/epubjs/dist/epub.js',
				'node_modules/localforage/dist/localforage.js',
				'lib/jquery.mobile-events.min.js',
				'lib/hyphen/*.js'])
		.pipe(concat('app-libs.min.js'))
		.pipe(uglify())
		.on('error', swallowError)
		.pipe(gulp.dest('dist/'))
		.pipe(touch());

		cb();
});

gulp.task('minifyJS', function(cb) {
	gulp
		.src(['js/app.js', 'js/reader.js'])
		.pipe(concat('app.min.js'))
		.pipe(uglify())
		.on('error', swallowError)
		.pipe(gulp.dest('dist/'));

	gulp
		.src('js/reader_iframe.js')
		.pipe(concat('reader_iframe.min.js'))
		.pipe(uglify())
		.on('error', swallowError)
		.pipe(gulp.dest('dist/'))
		.pipe(touch());

		cb();
});

gulp.task('minifyCSS', function(cb) {
  gulp
    .src(['css/app.less'])
		.pipe(less())
		.pipe(minifyCSS())
		.pipe(rename("app.min.css"))
		.on('error', swallowError)
		.pipe(gulp.dest('dist/'))
		.pipe(touch());

	gulp
		.src(['css/reader_iframe.less'])
		.pipe(less())
		.pipe(minifyCSS())
		.pipe(rename("reader_iframe.min.css"))
		.on('error', swallowError)
		.pipe(gulp.dest('dist/'))
		.pipe(touch());

  cb();
});

gulp.task(
  'default',
  function(cb) {
		gulp.series(['minifyCSS', 'minifyJS', 'minifyLibsJS'])();

		gulp.watch(['lib/**/*.js', 'lib/*.js', 'node_modules/**/.js'], gulp.series('minifyLibsJS'));
		gulp.watch(['js/*.js'], gulp.series('minifyJS'));
		gulp.watch(['css/*.less'], gulp.series('minifyCSS'));

    cb();
	}
);
