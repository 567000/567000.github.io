"use strict";

// グローバルに「world」インスタンスを用意しなければならない
var world = null;

/** LiquidFunの単位はメートル。px換算の数値を設定します。 */
var METER = 100;
/** 時間のステップを設定します。60FPSを示します。 */
var TIME_STEP = 1.0 / 60.0;
/** 速度の計算回数です。回数が多いほど正確になりますが、計算負荷が増えます。 */
var VELOCITY_ITERATIONS = 1;
/** 位置の計算回数です。回数が多いほど正確になりますが、計算負荷が増えます。 */
var POSITION_ITERATIONS = 1;
/** パーティクルのサイズです。 */
var SIZE_PARTICLE = 4;
/** ドラッグボールのサイズです。 */
var SIZE_DRAGBLE = 50;


/** 画面のサイズ(横幅)です。 */
var windowW = window.innerWidth;
/** 画面のサイズ(高さ)です。 */
var windowH = window.innerHeight;
/** DPIです。 */
var dpi = window.devicePixelRatio || 1.0;

/** [Pixi.js] ステージです。 */
var stage;
var renderer;
/** [Pixi.js] ドラッグボールの表示オブジェクトです。 */
var _pixiDragBall;
/** [Pixi.js] 粒子の表示オブジェクトの配列です。 */
var _pixiParticles = [];
var _isDragging = false;

/** [LiquidFun] パーティクルシステムです。 */
var _b2ParticleSystem;
var _b2GroundBody;

/** 端末ごとにパフォーマンスを調整するための変数です。 */
var performanceLevel;
switch (navigator.platform) {
  case "Win32": // Windowsだったら
  case "MacIntel": // OS Xだったら
    performanceLevel = "high";
    break;
  case "iPhone": // iPhoneだったら
  default: // その他の端末も
    performanceLevel = "low";
}

// ページが読み込み終わったら初期化する
window.addEventListener("load", init);

function init() {
  // 重力の設定
  var gravity = new b2Vec2(0, 10);
  // Box2D(LiquidFun)の世界を作成
  world = new b2World(gravity);

  // グランドの作成
  _b2GroundBody = world.CreateBody(new b2BodyDef());

  // Box2Dのコンテンツを作成
  createPhysicsWalls();
  createPhysicsParticles();

  // Pixiのコンテンツを作成
  createPixiWorld();

  // 定期的に呼び出す関数(エンターフレーム)を設定
  handleTick();

  // スマホの傾きに応じて重量の変更
  window.addEventListener("deviceorientation", deviceorientationHandler);
}

/** 傾き変更で重量の向きの変更 */
function deviceorientationHandler(event) {
  // 
  var x = 0;
  var y = 10;
  if (event.alpha!=null) {
    var rad = (event.alpha+45)/180 * Math.PI;
    x = 10 * Math.cos( rad );
    y = 10 * Math.sin( rad );
  }
  console.log(event.alpha);
  console.log(x);
  console.log(y);

  // 重力の設定
  world.setGravity(new b2Vec2(x,y));
}


/** LiquidFunの世界で「壁」を生成します。 */
function createPhysicsWalls() {

  var density = 0;

  var bdDef = new b2BodyDef();
  var bobo = world.CreateBody(bdDef);

  // 壁の生成 (天井)
  var wg = new b2PolygonShape();
  wg.SetAsBoxXYCenterAngle(
    windowW / METER / 2, // 幅
    5 / METER, // 高さ
    new b2Vec2(windowW / METER / 2, // X座標
      - 0.05), // Y座標
    0);
  bobo.CreateFixtureFromShape(wg, density);

  // 壁の生成 (地面)
  var wg = new b2PolygonShape();
  wg.SetAsBoxXYCenterAngle(
    windowW / METER / 2, // 幅
    5 / METER, // 高さ
    new b2Vec2(windowW / METER / 2, // X座標
      windowH / METER + 0.05), // Y座標
    0);
  bobo.CreateFixtureFromShape(wg, density);

  // 壁の生成 (左側)
  var wgl = new b2PolygonShape();
  wgl.SetAsBoxXYCenterAngle(
    5 / METER, // 幅
    windowH / METER / 2, // 高さ
    new b2Vec2(-0.05, // X座標
      windowH / METER / 2), // Y座標
    0);
  bobo.CreateFixtureFromShape(wgl, density);

  // 壁の生成 (右側)
  var wgr = new b2PolygonShape();
  wgr.SetAsBoxXYCenterAngle(
    5 / METER, // 幅
    windowH / METER / 2, // 高さ
    new b2Vec2(windowW / METER + 0.05, // X座標
      windowH / METER / 2), // Y座標
    0);

  bobo.CreateFixtureFromShape(wgr, density);
}

/** LiquidFunの世界で「粒子」を生成します。 */
function createPhysicsParticles() {
  // 粒子の作成 (プロパティーの設定)
  var psd = new b2ParticleSystemDef();
  psd.radius = SIZE_PARTICLE / METER; // 粒子の半径
  psd.pressureStrength = 4.0; // Increases pressure in response to compression Smaller values allow more compression
  _b2ParticleSystem = world.CreateParticleSystem(psd);

  // 粒子の発生領域
  var box = new b2PolygonShape();

  var w = (performanceLevel == "high") ? 256 : 128;
  var h = (performanceLevel == "high") ? 384 : 128;
  box.SetAsBoxXYCenterAngle(
    w / METER, // 幅
    h / METER, // 高さ
    new b2Vec2(windowW / 2 / METER, // 発生X座標
      0), // 発生Y座標
    0);
  var particleGroupDef = new b2ParticleGroupDef();
  particleGroupDef.shape = box; // 発生矩形を登録
  _b2ParticleSystem.CreateParticleGroup(particleGroupDef);
}

function createPixiWorld() {
  // Pixiの世界を作成
  renderer = new PIXI.WebGLRenderer(windowW, windowH);
  document.body.appendChild(renderer.view);
  stage = new PIXI.Container();

  // canvas 要素でグラフィックを作成 (ドローコール削減のため)
  var canvas = document.createElement("canvas");
  canvas.width = SIZE_PARTICLE * 2;
  canvas.height = SIZE_PARTICLE * 2;
  var ctx = canvas.getContext("2d");
  ctx.arc(SIZE_PARTICLE, SIZE_PARTICLE, SIZE_PARTICLE / 2, 0, 2 * Math.PI, false);
  ctx.fillStyle = "white";
  ctx.fill();

  // canvas 要素をテクスチャーに変換
  var texture = PIXI.Texture.fromCanvas(canvas);

  // パーティクルの作成
  var length = _b2ParticleSystem.GetPositionBuffer().length / 2;
  for (var i = 0; i < length; i++) {
    var shape = new PIXI.Sprite(texture); // シェイプを作成
    shape.pivot.x = SIZE_PARTICLE;
    shape.pivot.y = SIZE_PARTICLE;
    stage.addChild(shape); // 画面に追加
    _pixiParticles[i] = shape; // 配列に格納
  }
}

/** 時間経過で指出される関数です。 */
function handleTick() {
  // 物理演算エンジンを更新
  world.Step(TIME_STEP, VELOCITY_ITERATIONS, POSITION_ITERATIONS);

  // パーティクルシステムの計算結果を取得
  var particlesPositions = _b2ParticleSystem.GetPositionBuffer();

  // 粒子表現 : 物理演算エンジンとPixiの座標を同期
  for (var i = 0; i < _pixiParticles.length; i++) {
    var shape = _pixiParticles[i]; // 配列から要素を取得
    // LiquidFunの配列から座標を取得
    var xx = particlesPositions[i * 2] * METER;
    var yy = particlesPositions[(i * 2) + 1] * METER;
    // 座標を表示パーツに適用
    shape.x = xx;
    shape.y = yy;
  }

  // 画面を更新する
  renderer.render(stage);

  requestAnimationFrame(handleTick);
}


/**
 * LiquidFun の衝突判定に使うクラスです。
 * @constructor
 */
function QueryCallback(point) {
  this.point = point;
  this.fixture = null;
}
/**@return bool 当たり判定があれば true を返します。 */
QueryCallback.prototype.ReportFixture = function (fixture) {
  var body = fixture.body;
  if (body.GetType() === b2_dynamicBody) {
    var inside = fixture.TestPoint(this.point);
    if (inside) {
      this.fixture = fixture;
      return true;
    }
  }
  return false;
};
