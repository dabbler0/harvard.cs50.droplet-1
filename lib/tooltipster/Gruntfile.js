module.exports = function(grunt) {
	
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-compress');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-string-replace');
	grunt.loadNpmTasks('grunt-umd');
	
	grunt.initConfig({
		clean: {
			dist: ["dist"]
		},
		compress: {
			dist: {
				files: [
					{
						expand: true,
						ext: '.css.gz',
						extDot: 'last',
						src: ['dist/css/**/*.min.css']
					},
					{
						expand: true,
						ext: '.js.gz',
						extDot: 'last',
						src: ['dist/js/**/*.min.js']
					}
				],
				options: {
					mode: 'gzip',
					level: 9
				}
			}
		},
		concat: {
			// on the core and bundle files
			banner: {
				expand: true,
				src: ['dist/js/!(*.min).js'],
				options: {
					banner:
						'/**\n' +
						' * tooltipster http://iamceege.github.io/tooltipster/\n' +
						' * A rockin\' custom tooltip jQuery plugin\n' +
						' * Developed by Caleb Jacob and Louis Ameline\n' +
						' * MIT license\n' +
						' */\n'
				}
			},
			// on the core and bundle min files
			bannerMin: {
				expand: true,
				src: ['dist/js/*.min.js'],
				options: {
					banner: '/*! <%= pkg.name %> v<%= pkg.version %> */'
				}
			},
			// bundle = core + sideTip
			bundle: {
				files: [
					{
						dest: 'dist/css/tooltipster.bundle.css',
						src: ['dist/css/tooltipster.core.css', 'src/css/plugins/tooltipster/sideTip/tooltipster-sideTip.css']
					},
					{
						dest: 'dist/js/tooltipster.bundle.js',
						src: ['dist/js/tooltipster.core.js', 'src/js/plugins/tooltipster/sideTip/tooltipster-sideTip.js']
					}
				]
			},
			UMDReturn: {
				expand: true,
				src: ['dist/js/**/!(*.min).js'],
				options: {
					footer: 'return $;'
				}
			}
		},
		copy: {
			dist: {
				files: {
					'dist/css/tooltipster.core.css': 'src/css/tooltipster.css',
					'dist/js/tooltipster.core.js': 'src/js/tooltipster.js',
					'dist/js/plugins/tooltipster/SVG/tooltipster-SVG.js': 'src/js/plugins/tooltipster/SVG/tooltipster-SVG.js'
				}
			}
		},
		cssmin: {
			dist: {
				files: [
					{
						dest: 'dist/css/tooltipster.core.min.css',
						src: 'dist/css/tooltipster.core.css'
					},
					{
						dest: 'dist/css/tooltipster.bundle.min.css',
						src: 'dist/css/tooltipster.bundle.css'
					},
					{
						cwd: 'src/css/plugins',
						dest: 'dist/css/plugins',
						expand: true,
						ext: '.min.css',
						extDot: 'last',
						src: ['**/*.css']
					}
				]
			}
		},
		pkg: grunt.file.readJSON('package.json'),
		'string-replace': {
			dist: {
				files: {
					'dist/js/tooltipster.core.js': 'dist/js/tooltipster.core.js'
				},
				options: {
					replacements: [{
						pattern: 'semVer: \'\'',
						replacement: 'semVer: \'<%= pkg.version %>\''
					}]
				}
			}
		},
		uglify: {
			options: {
				compress: true,
				mangle: true,
				preserveComments: false
			},
			dist: {
				files: [{
					expand: true,
					ext: '.min.js',
					extDot: 'last',
					src: ['dist/js/**/!(*.min).js']
				}]
			}
		},
		umd: {
			// core and bundle
			dist: {
				options: {
					deps: {
						default: [{'jQuery': '$'}]
					},
					src: 'dist/js/**/!(*.min).js'
				}
			},
			// SVG pluging
			svg: {
				options: {
					deps: {
						default: [{'tooltipster': '$'}],
						global: [{jQuery: '$'}]
					},
					src: 'dist/js/plugins/tooltipster/SVG/tooltipster-SVG.js'
				}
			}
		}
	});
	
	grunt.registerTask('default', [
		// 'clean',
		'copy',
		'string-replace',
		'concat:bundle',
		'concat:UMDReturn',
		'umd',
		'uglify',
		'concat:banner',
		'concat:bannerMin',
		'cssmin',
		'compress'
	]);
};
