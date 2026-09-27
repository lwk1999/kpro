import { Guide, GuideProvider, useGuide, type GuideStepChangePayload } from '@kpro/react';
import { useCallback, useMemo, useState, type ReactElement } from 'react';

const PLACEMENTS: Array<{ serial: number; placement: 'top' | 'right' | 'bottom' | 'left'; label: string }> = [
  { serial: 1, placement: 'top', label: '上方' },
  { serial: 2, placement: 'right', label: '右侧' },
  { serial: 3, placement: 'bottom', label: '下方' },
  { serial: 4, placement: 'left', label: '左侧' },
];

function describe(payload: GuideStepChangePayload): string {
  return `${payload.from ?? '无'} → ${payload.to ?? '结束'}`;
}

export function App(): ReactElement {
  /** 指引组一：新手引导（三步）。 */
  const onboarding = useGuide('onboarding');
  /** 指引组二：数据面板引导，与组一相互独立。 */
  const analytics = useGuide('analytics');
  /** 指引组三：演示四种浮层方位。 */
  const placementGuide = useGuide('placement');

  const [logs, setLogs] = useState<string[]>([]);

  const log = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setLogs((previous) => [`[${time}] ${message}`, ...previous].slice(0, 12));
  }, []);

  const dismissedSummary = useMemo(
    () =>
      (
        [
          ['onboarding', onboarding.isDismissed],
          ['analytics', analytics.isDismissed],
          ['placement', placementGuide.isDismissed],
        ] as Array<[string, boolean]>
      )
        .map(([id, value]) => `${id}: ${value ? '已不再提示' : '可见'}`)
        .join(' · '),
    [onboarding.isDismissed, analytics.isDismissed, placementGuide.isDismissed],
  );

  const resetAll = useCallback(() => {
    onboarding.reset();
    analytics.reset();
    placementGuide.reset();
    log('已重置所有「不再提示」标记');
  }, [onboarding, analytics, placementGuide, log]);

  return (
    <div className="demo">
      <header className="demo__header">
        <h1>kpro 指引组件 · React 18 演示</h1>
        <p>
          点击下方按钮启动引导。目标 DOM 作为 <code>Guide</code> 的子元素传入，激活时会显示半透明遮罩并只高亮该元素。
          勾选「不再提示」后会被记住，刷新页面依然生效。
        </p>
      </header>

      <div className="demo__toolbar">
        <button type="button" className="demo__btn demo__btn--primary" onClick={() => onboarding.start()}>
          开始「新手引导」
        </button>
        <button type="button" className="demo__btn" onClick={() => analytics.start()}>
          开始「数据面板引导」
        </button>
        <button type="button" className="demo__btn" onClick={() => placementGuide.start()}>
          开始「方位演示」
        </button>
        <button type="button" className="demo__btn" onClick={resetAll}>
          重置「不再提示」
        </button>
      </div>

      <p className="demo__dismissed">{dismissedSummary}</p>

      {/* 指引组一：新手引导。Provider 声明组级「不再提示」能力。 */}
      <GuideProvider id="onboarding">
        <section className="demo__grid">
          <Guide
            id="onboarding"
            serial={1}
            title="第一步 · 新建项目"
            content="这里是新建入口，点击即可创建一个新项目。"
            onStepChange={(payload) => log(`onboarding 步骤切换 ${describe(payload)}`)}
            onFinish={() => log('onboarding 引导完成')}
            onClose={() => log('onboarding 引导关闭')}
            onDontShowAgain={() => log('onboarding 已设置为不再提示')}
          >
            <div className="demo__card">
              <div className="demo__stat">128</div>
              <h3>项目总数</h3>
              <p>当前工作区内的项目数量。</p>
              <button type="button" className="demo__btn demo__btn--primary">
                新建项目
              </button>
            </div>
          </Guide>

          <Guide
            id="onboarding"
            serial={2}
            title="第二步 · 邀请成员"
            content="把团队成员加入项目，协作从这里开始。"
          >
            <div className="demo__card">
              <div className="demo__stat">12</div>
              <h3>团队成员</h3>
              <p>点击可邀请新的成员加入协作。</p>
              <button type="button" className="demo__btn">
                邀请成员
              </button>
            </div>
          </Guide>

          <Guide
            id="onboarding"
            serial={3}
            title="第三步 · 发布上线"
            content="确认无误后即可把项目发布出去。"
          >
            <div className="demo__card">
              <div className="demo__stat">3</div>
              <h3>待发布</h3>
              <p>发布后线上环境会立即生效。</p>
              <button type="button" className="demo__btn">
                立即发布
              </button>
            </div>
          </Guide>
        </section>
      </GuideProvider>

      {/* 指引组二：数据面板。 */}
      <section className="demo__grid" style={{ marginTop: 16 }}>
        <Guide
          id="analytics"
          serial={1}
          title="访问量"
          content="统计近 7 天的页面访问量，点击可查看明细。"
          padding={10}
          onFinish={() => log('analytics 引导完成')}
        >
          <div className="demo__card">
            <div className="demo__stat">9,842</div>
            <h3>近 7 天访问量</h3>
            <p>较上周增长 12.4%。</p>
            <button type="button" className="demo__btn">
              查看明细
            </button>
          </div>
        </Guide>

        <Guide
          id="analytics"
          serial={2}
          title="导出报表"
          content="支持导出 CSV，方便做二次分析。"
          padding={10}
        >
          <div className="demo__card">
            <div className="demo__stat">CSV</div>
            <h3>导出报表</h3>
            <p>一键导出当前筛选条件下的数据。</p>
            <button type="button" className="demo__btn">
              导出
            </button>
          </div>
        </Guide>
      </section>

      {/* 指引组三：四种浮层方位。 */}
      <h3 style={{ margin: '28px 0 0', fontSize: 15 }}>浮层方位</h3>
      <p className="demo__hint">
        分别指定 placement 为 top / right / bottom / left，验证定位与视口边界收敛。
      </p>
      <div className="demo__placement-bar">
        {PLACEMENTS.map((item) => (
          <Guide
            key={item.serial}
            id="placement"
            serial={item.serial}
            placement={item.placement}
            title={`${item.label}定位`}
            content={`当前浮层显示在目标元素的${item.label}。`}
          >
            <button type="button" className="demo__btn">
              {item.label}定位
            </button>
          </Guide>
        ))}
      </div>

      <h3 style={{ margin: '24px 0 8px', fontSize: 15 }}>事件日志</h3>
      <div className="demo__log">
        {logs.length ? (
          logs.map((item, index) => <div key={index}>{item}</div>)
        ) : (
          <span>暂无事件，点击上方按钮开始引导。</span>
        )}
      </div>
      <p className="demo__hint">
        「不再提示」默认写入 localStorage 的 <code>kpro:guide:dismissed</code>，可通过
        <code>configureGuide</code> 更换存储键或接入服务端。
      </p>
    </div>
  );
}
