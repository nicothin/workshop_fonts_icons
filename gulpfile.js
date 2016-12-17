'use strict';

const pjson = require('./package.json');
const dirs = pjson.config.directories;

const gulp = require('gulp');
const less = require('gulp-less');
const rename = require('gulp-rename');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const mqpacker = require('css-mqpacker');
const replace = require('gulp-replace');
const del = require('del');
const fileinclude = require('gulp-file-include');
const browserSync = require('browser-sync').create();
const uglify = require('gulp-uglify');
const concat = require('gulp-concat');
const cheerio = require('gulp-cheerio');
const svgstore = require('gulp-svgstore');
const svgmin = require('gulp-svgmin');
const base64 = require('gulp-base64');
const notify = require('gulp-notify');
const plumber = require('gulp-plumber');
const cleanCSS = require('gulp-cleancss');

gulp.task('less', function(){
  return gulp.src(dirs.source + '/less/style.less')
    .pipe(plumber({ errorHandler: onError }))
    .pipe(less())
    .pipe(postcss([
        autoprefixer({ browsers: ['last 2 version'] }),
        mqpacker({ sort: true }),
    ]))
    .pipe(rename('style.min.css'))
    .pipe(cleanCSS())
    .pipe(gulp.dest(dirs.build + '/css/'))
    .pipe(browserSync.stream());
});

gulp.task('html', function() {
  return gulp.src(dirs.source + '/*.html')
    .pipe(plumber({ errorHandler: onError }))
    .pipe(fileinclude({
      prefix: '@@',
      basepath: '@file',
      indent: true,
    }))
    .pipe(replace(/\n\s*<!--DEV[\s\S]+?-->/gm, ''))
    .pipe(gulp.dest(dirs.build));
});

gulp.task('fonts:copy', function() {
  return gulp.src(dirs.source + '/fonts/**/*.{woff,ttf,woff2,eot,svg}')
    .pipe(gulp.dest(dirs.build + '/fonts/'))
    .pipe(browserSync.stream());
});

gulp.task('css:copy', function() {
  return gulp.src(dirs.source + '/css/*.css')
    .pipe(gulp.dest(dirs.build + '/css/'))
    .pipe(browserSync.stream());
});

gulp.task('img:copy', function() {
  return gulp.src(dirs.source + '/img/*.{jpg,png}')
    .pipe(gulp.dest(dirs.build + '/img/'))
    .pipe(browserSync.stream());
});

gulp.task('svgstore', function (callback) {
  let spritePath = dirs.source + '/img/svg-sprite';
  if(fileExist(spritePath) !== false) {
    return gulp.src(spritePath + '/*.svg')
      .pipe(plumber({ errorHandler: onError }))
      .pipe(svgmin(function (file) {
        return {
          plugins: [{
            cleanupIDs: {
              minify: true
            }
          }]
        }
      }))
      .pipe(svgstore({ inlineSvg: true }))
      .pipe(cheerio(function ($) {
        $('svg').attr('style',  'display:none');
      }))
      .pipe(rename('sprite-svg.svg'))
      .pipe(gulp.dest(dirs.source + '/img'));
  }
  else {
    console.log('Нет файлов для сборки SVG-спрайта');
    callback();
  }
});

gulp.task('clean', function () {
  return del([
    dirs.build + '/**/*',
    '!' + dirs.build + '/readme.md'
  ]);
});

gulp.task('js', function () {
  return gulp.src([
      dirs.source + '/js/script.js',
    ])
    .pipe(plumber({ errorHandler: onError }))
    .pipe(concat('script.min.js'))
    .pipe(uglify())
    .pipe(gulp.dest(dirs.build + '/js'));
});

gulp.task('js:font:loading:LS:min', function () {
  return gulp.src(dirs.source + '/fonts/font_loading.js')
    .pipe(plumber({ errorHandler: onError }))
    .pipe(rename('font_loading.min.js'))
    .pipe(uglify())
    .pipe(gulp.dest(dirs.source + '/fonts/'));
});

gulp.task('css:fonts:woff', function (callback) {
  let fontsCssPath = [
    dirs.source + '/fonts/fonts_woff.css',
  ];
  var filesExists = true;
  fontsCssPath.forEach(function(item) {
    if(fileExist(item) === false) {
      filesExists = false;
    }
  });
  if(filesExists) {
    return gulp.src(fontsCssPath)
      .pipe(plumber({ errorHandler: onError }))
      .pipe(base64({
        // baseDir: '/',
        extensions: ['woff'],
        maxImageSize: 1024*1024,
        deleteAfterEncoding: false,
        // debug: true
      }))
      .pipe(cleanCSS())
      .pipe(gulp.dest(dirs.build + '/css'));
  }
  else {
    console.log('Файла WOFF, из которого генерируется CSS с base64-кодированным шрифтом, нет');
    console.log('Отсутствующий файл: ' + fontsCssPath);
    callback();
}
});

gulp.task('css:fonts:woff2', function (callback) {
  let fontsCssPath = [
    dirs.source + '/fonts/fonts_woff2.css',
  ];
  var filesExists = true;
  fontsCssPath.forEach(function(item) {
    if(fileExist(item) === false) {
      filesExists = false;
    }
  });
  if(filesExists) {
    return gulp.src(fontsCssPath)
      .pipe(plumber({ errorHandler: onError }))
      .pipe(base64({
        // baseDir: '/',
        extensions: ['woff2'],
        maxImageSize: 1024*1024,
        deleteAfterEncoding: false,
        // debug: true
      }))
      .pipe(replace('application/octet-stream;', 'application/font-woff2;')) // костыль, ибо mime плагин для woff2 определяет некорректно
      .pipe(cleanCSS())
      .pipe(gulp.dest(dirs.build + '/css'));
  }
  else {
    console.log('Файла WOFF2, из которого генерируется CSS с base64-кодированным шрифтом, нет');
    console.log('Отсутствующий файл: ' + fontsCssPath);
    callback();
  }
});

gulp.task('build', gulp.series(
  'clean',
  'svgstore',
  gulp.parallel('less', 'js', 'img:copy', 'css:copy', 'fonts:copy', 'js:font:loading:LS:min', 'css:fonts:woff', 'css:fonts:woff2'),
  'html'
));

gulp.task('serve', gulp.series('build', function() {

  browserSync.init({
    server: dirs.build,
    port: 3000,
    startPath: 'index.html',
    // open: false
  });

  gulp.watch(
    [
      dirs.source + '/**/*.html',
    ],
    gulp.series('html', reloader)
  );

  gulp.watch(
    dirs.source + '/less/**/*.less',
    gulp.series('less')
  );

  gulp.watch(
    dirs.source + '/css/*.css',
    gulp.series('css:copy')
  );

  gulp.watch(
    dirs.source + '/fonts/*.{woff,ttf,woff2}',
    gulp.series('fonts:copy')
  );

  gulp.watch(
    dirs.source + '/img/svg-sprite/*.svg',
    gulp.series('svgstore', 'html', reloader)
  );

  gulp.watch(
    dirs.source + '/js/*.js',
    gulp.series('js', reloader)
  );

}));

gulp.task('default',
  gulp.series('serve')
);

// Дополнительная функция для перезагрузки в браузере
function reloader(done) {
  browserSync.reload();
  done();
}

// Проверка существования файла/папки
function fileExist(path) {
  const fs = require('fs');
  try {
    fs.statSync(path);
  } catch(err) {
    return !(err && err.code === 'ENOENT');
  }
}

var onError = function(err) {
    notify.onError({
      title: "Error in " + err.plugin,
    })(err);
    this.emit('end');
};
