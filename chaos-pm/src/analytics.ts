import mixpanel from 'mixpanel-browser';

mixpanel.init('b500853bd0fa70e8e5e528b81ecd6d62', {
  track_pageview: false,
  persistence: 'localStorage',
  ignore_dnt: true,
});

export function analyticsIdentify(email: string, props?: { name?: string; createdAt?: number }) {
  mixpanel.identify(email);
  mixpanel.people.set({
    $email: email,
    $name: props?.name ?? email,
    ...(props?.createdAt ? { $created: new Date(props.createdAt).toISOString() } : {}),
  });
}

export function analyticsReset() {
  mixpanel.reset();
}

export function track(event: string, props?: Record<string, unknown>) {
  mixpanel.track(event, props);
}
